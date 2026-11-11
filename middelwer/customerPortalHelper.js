const { conn } = require("./db");
const { DataFind } = require("./databaseQurey");
const OrderTypes = require("../public/js/shared/orderTypes");

const ORDER_STATUS_SUBMITTED = 9;
const ORDER_STATUS_ACCEPTED = 10;

let pickupAddressSchemaVerified = false;

/**
 * Ensures tbl_order has the optional pickup_address column for customer route requests,
 * and ensures tbl_orderstatus contains 'Submitted' (9) and 'Accepted' (10).
 */
async function ensurePickupAddressSchema() {
  if (pickupAddressSchemaVerified) return;
  try {
    const promiseConn = conn.promise();
    const [cols] = await promiseConn.query("SHOW COLUMNS FROM tbl_order");
    if (!cols.some((c) => c.Field === "pickup_address")) {
      await promiseConn.query(
        "ALTER TABLE tbl_order ADD COLUMN pickup_address VARCHAR(255) NULL DEFAULT NULL AFTER pickup_date"
      );
    }

    const [statusRows] = await promiseConn.query(
      "SELECT id, status FROM tbl_orderstatus WHERE id IN (?, ?)",
      [ORDER_STATUS_SUBMITTED, ORDER_STATUS_ACCEPTED]
    );
    const byId = {};
    (statusRows || []).forEach((r) => {
      byId[Number(r.id)] = r.status;
    });
    if (!byId[ORDER_STATUS_SUBMITTED]) {
      await promiseConn.query("INSERT INTO tbl_orderstatus (id, status) VALUES (?, 'Submitted')", [
        ORDER_STATUS_SUBMITTED,
      ]);
    }
    if (!byId[ORDER_STATUS_ACCEPTED]) {
      await promiseConn.query("INSERT INTO tbl_orderstatus (id, status) VALUES (?, 'Accepted')", [
        ORDER_STATUS_ACCEPTED,
      ]);
    }

    pickupAddressSchemaVerified = true;
  } catch (err) {
    console.error("Warning: ensurePickupAddressSchema failed:", err.message);
  }
}

/**
 * Safely trims and truncates strings to fit column constraints without SQL truncation errors.
 */
function truncateText(val, maxLen = 255) {
  if (val === undefined || val === null) return "";
  return String(val).trim().slice(0, maxLen);
}

/**
 * Normalizes customer-selectable route pickup order types to canonical values.
 * Supports return delivery ('Route • Route') or store pickup ('Route • Counter').
 */
function normalizeCustomerOrderType(rawType) {
  const normalized = OrderTypes.normalize(rawType || "");
  if (
    normalized === "Route • Counter" ||
    normalized === "Pick-up • Counter" ||
    normalized === "R • C" ||
    normalized === "Store collection • Customer pick-up"
  ) {
    return OrderTypes.CANONICAL.PICKUP_COUNTER;
  }
  return OrderTypes.CANONICAL.PICKUP_DELIVERY;
}

/**
 * Parses and validates customer pickup date (YYYY-MM-DD) and time (HH:MM) in local server time.
 */
function parseCustomerPickupDateTime(dateStr, timeStr) {
  const cleanDate = String(dateStr || "").trim();
  const cleanTime = String(timeStr || "").trim();

  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cleanDate);
  if (!dateMatch) {
    return { valid: false, message: "Please select a valid pick-up date (YYYY-MM-DD)." };
  }

  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(cleanTime);
  if (!timeMatch) {
    return { valid: false, message: "Please select a valid pick-up time." };
  }

  const year = parseInt(dateMatch[1], 10);
  const month = parseInt(dateMatch[2], 10);
  const day = parseInt(dateMatch[3], 10);
  const hour = parseInt(timeMatch[1], 10);
  const minute = parseInt(timeMatch[2], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return { valid: false, message: "Invalid pick-up date or time values." };
  }

  const dt = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    isNaN(dt.getTime()) ||
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return { valid: false, message: "Please enter a valid calendar date." };
  }

  // Allow up to 5 minutes clock skew for immediate "right now" selections
  if (dt.getTime() < Date.now() - 5 * 60 * 1000) {
    return { valid: false, message: "Pick-up date and time cannot be in the past." };
  }

  const hh = String(hour).padStart(2, "0");
  const min = String(minute).padStart(2, "0");
  return {
    valid: true,
    isoDate: cleanDate,
    isoTime: `${hh}:${min}`,
    mysqlDateTime: `${cleanDate} ${hh}:${min}:00`,
    dateObj: dt,
  };
}

/**
 * Formats a Date/timestamp into local YYYY-MM-DD for HTML date inputs.
 */
function extractLocalDateIso(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Formats a Date/timestamp into local HH:MM for HTML time inputs.
 */
function extractLocalTimeIso(dt) {
  if (!dt) return "";
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * Formats a Date/timestamp as readable date e.g. 'Nov 12, 2026'.
 */
function formatHumanDate(dt) {
  if (!dt) return "—";
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a Date/timestamp as readable date + 12h time e.g. 'Nov 12, 2026 at 10:00 AM'.
 */
function formatHumanDateTime(dt) {
  if (!dt) return "—";
  const d = dt instanceof Date ? dt : new Date(dt);
  if (isNaN(d.getTime())) return "—";
  const datePart = formatHumanDate(d);
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${datePart} at ${timePart}`;
}

/**
 * Combines customer profile address fields into a single line.
 */
function formatCustomerProfileAddress(customer) {
  if (!customer) return "";
  return [customer.address, customer.city, customer.state, customer.zipcode]
    .map((v) => (v ? String(v).trim() : ""))
    .filter(Boolean)
    .join(", ");
}

/**
 * Formats customer display name according to workspace Last Name, First Name convention.
 */
function formatCustomerName(customer) {
  if (!customer) return "Customer";
  const first = customer.first_name ? String(customer.first_name).trim() : "";
  const last = customer.last_name ? String(customer.last_name).trim() : "";
  if (last && first) return `${last}, ${first}`;
  return customer.name ? String(customer.name).trim() : "Customer";
}

/**
 * Resolves customer record and active assigned store record.
 */
async function resolveCustomerStoreContext(customerId, fallbackStoreId = null) {
  const custRows = await DataFind(
    `SELECT id, name, first_name, last_name, number, email, address, city, state, zipcode, store_ID, reffstore, customer_type, memo, img
     FROM tbl_customer
     WHERE id = ? AND delet_flage = 0
     LIMIT 1`,
    [Number(customerId)]
  );
  if (!custRows || custRows.length === 0) {
    return { customer: null, store: null };
  }

  const customer = custRows[0];
  let resolvedStoreId = null;
  const candidates = [customer.store_ID, customer.reffstore, fallbackStoreId];
  for (const cand of candidates) {
    if (cand && String(cand).trim() !== "" && String(cand).trim() !== "0") {
      resolvedStoreId = String(cand).trim();
      break;
    }
  }

  let storeRows = resolvedStoreId
    ? await DataFind(
        `SELECT id, name, mobile_number, store_email, address, city, state, zipcode, tax_percent, order_prefix
         FROM tbl_store
         WHERE id = ? AND delete_flage = 0
         LIMIT 1`,
        [Number(resolvedStoreId)]
      )
    : [];

  if (!storeRows || storeRows.length === 0) {
    storeRows = await DataFind(
      `SELECT id, name, mobile_number, store_email, address, city, state, zipcode, tax_percent, order_prefix
       FROM tbl_store
       WHERE status = 1 AND delete_flage = 0
       ORDER BY id ASC
       LIMIT 1`
    );
  }

  return {
    customer,
    store: storeRows && storeRows.length > 0 ? storeRows[0] : null,
  };
}

/**
 * Builds the 5-stage customer progress tracker stages for an order/request.
 */
function buildCustomerOrderStages(ord, storeName, totalPieces) {
  const statusNum = Number(ord.order_status) || 1;
  const orderType = ord.order_type || OrderTypes.CANONICAL.PICKUP_DELIVERY;
  const hasPickup = OrderTypes.hasPickup(orderType);
  const hasDelivery = OrderTypes.hasDelivery(orderType);
  const isPickedUp = String(ord.is_picked_up || "0") === "1";
  const isDelivered = String(ord.is_delivered || "0") === "1";
  const isZeroItem = !ord.service_list || String(ord.service_list).trim() === "" || String(ord.service_list).trim() === "0";
  const isCancelled = statusNum === 6;
  const isReturned = statusNum === 5;
  const isSubmitted = statusNum === ORDER_STATUS_SUBMITTED;
  const isAcceptedStatus = statusNum === ORDER_STATUS_ACCEPTED;
  const isCompleted = !isCancelled && !isReturned && (statusNum === 4 || isDelivered);
  const isAcceptedOrBeyond = !isCancelled && !isReturned && statusNum !== 8 && (!isSubmitted || isPickedUp);

  // Stage 2: Request Accepted (or Store Drop-Off Confirmed)
  const stage2Done = hasPickup ? isAcceptedOrBeyond : (!isCancelled && !isReturned && statusNum !== 8);
  const stage2Current = !isCancelled && !isReturned && hasPickup && isSubmitted && !isPickedUp;

  // Stage 3: Picked Up by Driver & Cleaning Process
  const stage3Done = !isCancelled && !isReturned && (statusNum === 3 || isCompleted);
  const stage3Current =
    !isCancelled &&
    !isReturned &&
    !stage3Done &&
    stage2Done &&
    (isAcceptedStatus || statusNum === 1 || statusNum === 2 || statusNum === 7 || isPickedUp || !isZeroItem);

  let stage3Title = "Picked Up & Cleaning";
  let stage3Subtitle = "Starts after store acceptance";
  if (stage3Done) {
    stage3Title = "Cleaned & Inspected";
    stage3Subtitle = ord.ready_date ? `Ready target: ${formatHumanDate(ord.ready_date)}` : `${totalPieces} pc(s) ready`;
  } else if (stage3Current) {
    if (hasPickup && !isPickedUp && (isAcceptedStatus || statusNum === 1)) {
      stage3Title = "Accepted · Awaiting Pick-up";
      stage3Subtitle = ord.pickup_date ? `Pick-up: ${formatHumanDateTime(ord.pickup_date)}` : "Driver assigned";
    } else if (isPickedUp && statusNum !== 2 && isZeroItem) {
      stage3Title = "Picked Up by Driver";
      stage3Subtitle = ord.picked_up_at ? formatHumanDateTime(ord.picked_up_at) : "En route to store inspection";
    } else if (statusNum === 2 || !isZeroItem) {
      stage3Title = statusNum === 2 ? "Cleaning in Process" : "Inspected & Cleaning";
      stage3Subtitle = ord.ready_date ? `Ready target: ${formatHumanDate(ord.ready_date)}` : `${totalPieces} pc(s) itemized`;
    } else {
      stage3Title = "Awaiting Pick-up";
      stage3Subtitle = ord.pickup_date ? formatHumanDateTime(ord.pickup_date) : "Scheduled";
    }
  }

  // Stage 4: Ready for Delivery / Store Pickup
  const stage4Done = isCompleted;
  const stage4Current = !isCancelled && !isReturned && !stage4Done && statusNum === 3;

  // Stage 5: Completed
  const stage5Done = isCompleted;

  return [
    {
      key: "submitted",
      icon: "fa-calendar-check",
      title: hasPickup ? "Request Submitted" : "Order Placed",
      subtitle: hasPickup && ord.pickup_date
        ? `Pick-up: ${formatHumanDateTime(ord.pickup_date)}`
        : `Booked ${formatHumanDate(ord.order_date)}`,
      state: "done",
    },
    {
      key: "accepted",
      icon: hasPickup ? "fa-clipboard-check" : "fa-store",
      title: hasPickup
        ? (isCancelled ? "Request Cancelled" : (stage2Done ? "Request Accepted" : "Awaiting Acceptance"))
        : "Received at Store",
      subtitle: hasPickup
        ? (isCancelled
            ? (ord.void_reason || "Cancelled")
            : (stage2Done
                ? `Confirmed: ${formatHumanDateTime(ord.pickup_date)}`
                : "Pending store review (editable)"))
        : `Dropped off ${formatHumanDate(ord.order_date)}`,
      state: isCancelled ? "cancelled" : (stage2Done ? "done" : (stage2Current ? "current" : "upcoming")),
    },
    {
      key: "processing",
      icon: isPickedUp || !hasPickup ? "fa-tshirt" : "fa-truck-pickup",
      title: stage3Title,
      subtitle: stage3Subtitle,
      state: isCancelled ? "cancelled" : (stage3Done ? "done" : (stage3Current ? "current" : "upcoming")),
    },
    {
      key: "ready",
      icon: hasDelivery ? "fa-shipping-fast" : "fa-box-open",
      title: hasDelivery ? "Ready for Delivery" : "Ready for Pick-up",
      subtitle: stage4Done
        ? (hasDelivery ? "Dispatched" : "Collected")
        : (stage4Current
            ? (hasDelivery ? `Scheduled ${formatHumanDate(ord.delivery_date)}` : `At ${storeName || "store"}`)
            : (hasDelivery && ord.delivery_date ? `Est. ${formatHumanDate(ord.delivery_date)}` : "Pending cleaning")),
      state: isCancelled ? "cancelled" : (stage4Done ? "done" : (stage4Current ? "current" : "upcoming")),
    },
    {
      key: "completed",
      icon: "fa-check-double",
      title: hasDelivery ? "Delivered" : "Completed",
      subtitle: isDelivered && ord.delivered_at
        ? formatHumanDateTime(ord.delivered_at)
        : (stage5Done ? "Order completed" : "Pending completion"),
      state: isCancelled ? "cancelled" : (stage5Done ? "done" : "upcoming"),
    },
  ];
}

/**
 * Fetches all customer orders & pickup requests enriched with itemized garments, timeline stages, and KPIs.
 */
async function loadCustomerOrdersEnriched(customerId, fallbackStoreName = "Store") {
  await ensurePickupAddressSchema();

  const orders = await DataFind(
    `SELECT
       o.*,
       COALESCE(s.status, 'Pending') AS status_name,
       COALESCE(st.name, '') AS store_name,
       COALESCE(st.mobile_number, '') AS store_phone,
       COALESCE(st.address, '') AS store_address
     FROM tbl_order o
     LEFT JOIN tbl_orderstatus s ON o.order_status = s.id
     LEFT JOIN tbl_store st ON o.store_id = st.id
     WHERE o.customer_id = ?
     ORDER BY o.id DESC`,
    [String(customerId)]
  );

  // Batch-load service items in one query
  const serviceIdSet = new Set();
  (orders || []).forEach((ord) => {
    const raw = String(ord.service_list || "").trim();
    if (raw && raw !== "0") {
      raw.split(",").forEach((s) => {
        const clean = parseInt(s.trim(), 10);
        if (!isNaN(clean) && clean > 0) serviceIdSet.add(clean);
      });
    }
  });

  const serviceItemMap = {};
  if (serviceIdSet.size > 0) {
    const idList = Array.from(serviceIdSet);
    const placeholders = idList.map(() => "?").join(",");
    const items = await DataFind(
      `SELECT id, service_name, service_type_name, service_type_price, service_quntity, no_of_items, primary_color, brand_label
       FROM tbl_cart_servicelist
       WHERE id IN (${placeholders})`,
      idList
    );
    (items || []).forEach((item) => {
      serviceItemMap[String(item.id)] = item;
    });
  }

  let activeCount = 0;
  let pendingPickupsCount = 0;
  let completedCount = 0;
  let cancelledCount = 0;
  let outstandingBalance = 0;

  const enrichedOrders = (orders || []).map((ord) => {
    const orderType = ord.order_type || OrderTypes.CANONICAL.COUNTER_COUNTER;
    const hasPickup = OrderTypes.hasPickup(orderType);
    const hasDelivery = OrderTypes.hasDelivery(orderType);
    const statusNum = Number(ord.order_status) || 1;
    const isPickedUp = String(ord.is_picked_up || "0") === "1";
    const isDelivered = String(ord.is_delivered || "0") === "1";
    const isSubmitted = statusNum === ORDER_STATUS_SUBMITTED;
    const isAccepted = statusNum === ORDER_STATUS_ACCEPTED;
    const isCancelled = statusNum === 6;
    const isReturned = statusNum === 5;
    const isCompleted = !isCancelled && !isReturned && (statusNum === 4 || isDelivered);
    const isActive = !isCancelled && !isReturned && !isCompleted;
    // Customer can change date/time or cancel ONLY before store accepts (while status is Submitted)
    const canModifyPickup = hasPickup && isSubmitted && !isPickedUp;

    const orderItems = [];
    let totalPieces = 0;
    const rawService = String(ord.service_list || "").trim();
    if (rawService && rawService !== "0") {
      rawService.split(",").forEach((sid) => {
        const item = serviceItemMap[String(parseInt(sid.trim(), 10))];
        if (item) {
          const qty = parseFloat(item.service_quntity || 1) || 1;
          const pcs = parseInt(item.no_of_items || 1, 10) || 1;
          totalPieces += Math.round(qty * pcs);
          orderItems.push({
            id: item.id,
            service_name: item.service_name || "Service",
            service_type_name: item.service_type_name || "",
            qty,
            pieces: pcs,
            rate: parseFloat(item.service_type_price || 0),
            lineTotal: parseFloat((parseFloat(item.service_type_price || 0) * qty).toFixed(2)),
            brand_label: item.brand_label || "",
            primary_color: item.primary_color || "",
          });
        }
      });
    }

    const isZeroItem = orderItems.length === 0;
    const grossTotal = parseFloat(ord.gross_total || 0);
    const paidAmount = parseFloat(ord.paid_amount || 0);
    const balanceAmount = parseFloat(
      ord.balance_amount !== undefined && ord.balance_amount !== null
        ? ord.balance_amount
        : Math.max(0, grossTotal - paidAmount)
    );

    if (isActive) activeCount++;
    if (canModifyPickup) pendingPickupsCount++;
    if (isCompleted) completedCount++;
    if (isCancelled || isReturned) cancelledCount++;
    if (!isCancelled && !isReturned && balanceAmount > 0.001) {
      outstandingBalance += balanceAmount;
    }

    let statusBadgeClass = "status-processing";
    let statusDisplay = ord.status_name || "Pending";
    if (isSubmitted) {
      statusBadgeClass = "status-submitted";
      statusDisplay = "Submitted";
    } else if (isAccepted) {
      statusBadgeClass = "status-accepted";
      statusDisplay = "Accepted";
    } else if (statusNum === 1) {
      statusBadgeClass = "status-pending";
      statusDisplay = "Pending";
    } else if (statusNum === 2) {
      statusBadgeClass = "status-processing";
    } else if (statusNum === 3) {
      statusBadgeClass = "status-ready";
      statusDisplay = hasDelivery ? "Ready for Delivery" : "Ready for Pick-up";
    } else if (statusNum === 4 || isDelivered) {
      statusBadgeClass = "status-delivered";
      statusDisplay = hasDelivery ? "Delivered" : "Completed";
    } else if (statusNum === 5) {
      statusBadgeClass = "status-returned";
    } else if (statusNum === 6) {
      statusBadgeClass = "status-cancelled";
      statusDisplay = "Cancelled";
    } else if (statusNum === 8) {
      statusBadgeClass = "status-draft";
    }

    const storeLabel = ord.store_name || fallbackStoreName;
    const stages = buildCustomerOrderStages(ord, storeLabel, totalPieces);

    return {
      ...ord,
      orderTypeDisplay: OrderTypes.formatDisplay(orderType),
      canonicalOrderType: normalizeCustomerOrderType(orderType),
      hasPickup,
      hasDelivery,
      isPickedUp,
      isDelivered,
      isSubmitted,
      isAccepted,
      isCancelled,
      isReturned,
      isCompleted,
      isActive,
      isZeroItem,
      canModifyPickup,
      items: orderItems,
      totalPieces,
      grossTotal: Number(grossTotal.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      balanceAmount: Number(balanceAmount.toFixed(2)),
      statusBadgeClass,
      statusDisplay,
      storeLabel,
      pickupDateIso: extractLocalDateIso(ord.pickup_date),
      pickupTimeIso: extractLocalTimeIso(ord.pickup_date) || "10:00",
      formattedOrderDate: formatHumanDate(ord.order_date),
      formattedPickupDateTime: formatHumanDateTime(ord.pickup_date),
      formattedReadyDateTime: formatHumanDateTime(ord.ready_date || ord.delivery_date),
      formattedDeliveryDateTime: formatHumanDateTime(ord.delivery_date),
      formattedPickedUpAt: formatHumanDateTime(ord.picked_up_at),
      formattedDeliveredAt: formatHumanDateTime(ord.delivered_at),
      stages,
    };
  });

  return {
    orders: enrichedOrders,
    stats: {
      activeCount,
      pendingPickupsCount,
      completedCount,
      cancelledCount,
      outstandingBalance: Number(outstandingBalance.toFixed(2)),
      totalCount: enrichedOrders.length,
    },
  };
}

module.exports = {
  ORDER_STATUS_SUBMITTED,
  ORDER_STATUS_ACCEPTED,
  ensurePickupAddressSchema,
  truncateText,
  normalizeCustomerOrderType,
  parseCustomerPickupDateTime,
  extractLocalDateIso,
  extractLocalTimeIso,
  formatHumanDate,
  formatHumanDateTime,
  formatCustomerProfileAddress,
  formatCustomerName,
  resolveCustomerStoreContext,
  buildCustomerOrderStages,
  loadCustomerOrdersEnriched,
};
