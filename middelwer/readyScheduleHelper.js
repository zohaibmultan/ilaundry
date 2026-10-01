const { DataFind } = require("./databaseQurey");

/**
 * Resolves effective ready schedule configuration for a given store.
 * Merges tbl_store settings with tbl_master_shop global fallbacks.
 */
async function getEffectiveReadySchedule(storeId) {
  let masterRow = null;
  try {
    const masterData = await DataFind("SELECT * FROM tbl_master_shop WHERE id = 1");
    if (masterData && masterData.length > 0) {
      masterRow = masterData[0];
    }
  } catch (err) {
    console.error("Error fetching tbl_master_shop in getEffectiveReadySchedule:", err);
  }

  const globalLeadDays = masterRow && masterRow.ready_lead_days !== undefined && masterRow.ready_lead_days !== null ? parseInt(masterRow.ready_lead_days) : 2;
  const globalCutoffTime = masterRow && masterRow.ready_cutoff_time ? String(masterRow.ready_cutoff_time).trim() : "13:00";
  const globalReadyTime = masterRow && masterRow.ready_time ? String(masterRow.ready_time).trim() : "16:00";
  const globalWorkingDays = masterRow && masterRow.ready_working_days ? String(masterRow.ready_working_days).trim() : "1,2,3,4,5,6";

  if (!storeId || storeId === "0" || storeId === 0) {
    return {
      leadDays: globalLeadDays,
      cutoffTime: globalCutoffTime,
      readyTime: globalReadyTime,
      workingDays: globalWorkingDays.split(",").map((d) => parseInt(d.trim())).filter((d) => !isNaN(d)),
      workingDaysRaw: globalWorkingDays,
    };
  }

  let storeRow = null;
  try {
    const storeData = await DataFind(`SELECT * FROM tbl_store WHERE id = '${storeId}'`);
    if (storeData && storeData.length > 0) {
      storeRow = storeData[0];
    }
  } catch (err) {
    console.error("Error fetching tbl_store in getEffectiveReadySchedule:", err);
  }

  const hasStoreLead = storeRow && storeRow.ready_lead_days !== null && storeRow.ready_lead_days !== undefined && String(storeRow.ready_lead_days).trim() !== "";
  const hasStoreCutoff = storeRow && storeRow.ready_cutoff_time && String(storeRow.ready_cutoff_time).trim() !== "";
  const hasStoreReady = storeRow && storeRow.ready_time && String(storeRow.ready_time).trim() !== "";
  const hasStoreWorking = storeRow && storeRow.ready_working_days && String(storeRow.ready_working_days).trim() !== "";

  const leadDays = hasStoreLead ? parseInt(storeRow.ready_lead_days) : globalLeadDays;
  const cutoffTime = hasStoreCutoff ? String(storeRow.ready_cutoff_time).trim() : globalCutoffTime;
  const readyTime = hasStoreReady ? String(storeRow.ready_time).trim() : globalReadyTime;
  const workingDaysRaw = hasStoreWorking ? String(storeRow.ready_working_days).trim() : globalWorkingDays;

  return {
    leadDays: isNaN(leadDays) ? 2 : leadDays,
    cutoffTime: cutoffTime || "13:00",
    readyTime: readyTime || "16:00",
    workingDays: workingDaysRaw.split(",").map((d) => parseInt(d.trim())).filter((d) => !isNaN(d)),
    workingDaysRaw,
  };
}

/**
 * Calculates Ready Date and Ready Time given intake timestamp and effective schedule.
 *
 * Rules:
 * - Compares intake time with cutoffTime (e.g. 13:00 / 1:00 PM).
 * - If intake time >= cutoffTime: Required working days = leadDays + 1.
 * - Else: Required working days = leadDays.
 * - Traverses forward day-by-day, only counting days present in workingDays (0=Sun, 1=Mon, ..., 6=Sat).
 * - Fixes time to readyTime (e.g. 16:00 / 4:00 PM).
 */
function calculateReadyDateTime(intakeInput, schedule) {
  const sched = schedule || {
    leadDays: 2,
    cutoffTime: "13:00",
    readyTime: "16:00",
    workingDays: [1, 2, 3, 4, 5, 6],
  };

  let intakeDate = new Date();
  let explicitTimeProvided = false;

  if (intakeInput instanceof Date && !isNaN(intakeInput.getTime())) {
    intakeDate = new Date(intakeInput.getTime());
    explicitTimeProvided = true;
  } else if (typeof intakeInput === "string" && intakeInput.trim() !== "") {
    const trimmed = intakeInput.trim();
    if (trimmed.includes("T") || trimmed.includes(" ")) {
      const parsed = new Date(trimmed);
      if (!isNaN(parsed.getTime())) {
        intakeDate = parsed;
        explicitTimeProvided = true;
      }
    } else {
      // Date only (YYYY-MM-DD): keep current time of day to accurately evaluate cutoff
      const parts = trimmed.split("-");
      if (parts.length === 3) {
        const now = new Date();
        intakeDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10), now.getHours(), now.getMinutes(), now.getSeconds());
      }
    }
  }

  // Parse cutoff time HH:mm
  const [cHour, cMin] = (sched.cutoffTime || "13:00").split(":").map((v) => parseInt(v, 10) || 0);
  const intakeMinutes = intakeDate.getHours() * 60 + intakeDate.getMinutes();
  const cutoffMinutes = cHour * 60 + cMin;
  const isAfterCutoff = intakeMinutes >= cutoffMinutes;

  let requiredDays = isAfterCutoff ? sched.leadDays + 1 : sched.leadDays;
  if (requiredDays < 0) requiredDays = 0;

  const workingDays = Array.isArray(sched.workingDays) && sched.workingDays.length > 0 ? sched.workingDays : [1, 2, 3, 4, 5, 6];

  // Start with intake calendar day (midnight)
  let cur = new Date(intakeDate.getFullYear(), intakeDate.getMonth(), intakeDate.getDate(), 12, 0, 0);

  // If intake occurred on a non-working day, advance to the first working day first
  while (!workingDays.includes(cur.getDay())) {
    cur.setDate(cur.getDate() + 1);
  }

  // Count forward working days
  while (requiredDays > 0) {
    cur.setDate(cur.getDate() + 1);
    if (workingDays.includes(cur.getDay())) {
      requiredDays--;
    }
  }

  const yyyy = cur.getFullYear();
  const mm = String(cur.getMonth() + 1).padStart(2, "0");
  const dd = String(cur.getDate()).padStart(2, "0");
  const readyDate = `${yyyy}-${mm}-${dd}`;

  const cleanReadyTime = sched.readyTime && sched.readyTime.length >= 4 ? sched.readyTime : "16:00";
  const [rHour, rMin] = cleanReadyTime.split(":").map((v) => parseInt(v, 10) || 0);
  const period = rHour >= 12 ? "PM" : "AM";
  const hour12 = rHour % 12 === 0 ? 12 : rHour % 12;
  const timeFormatted = `${String(hour12).padStart(2, "0")}:${String(rMin).padStart(2, "0")} ${period}`;

  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthsOfYear = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const humanFormatted = `${daysOfWeek[cur.getDay()]}, ${monthsOfYear[cur.getMonth()]} ${dd}, ${yyyy} ${timeFormatted}`;

  return {
    readyDate,
    readyTime: cleanReadyTime,
    combinedTimestamp: `${readyDate} ${String(rHour).padStart(2, "0")}:${String(rMin).padStart(2, "0")}:00`,
    isAfterCutoff,
    effectiveLeadDays: isAfterCutoff ? sched.leadDays + 1 : sched.leadDays,
    leadDays: sched.leadDays,
    cutoffTime: sched.cutoffTime,
    formatted: humanFormatted,
  };
}

module.exports = {
  getEffectiveReadySchedule,
  calculateReadyDateTime,
};
