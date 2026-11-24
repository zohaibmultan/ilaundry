const { mySqlQury } = require("./db");

const DEFAULT_GENDERS = [
  { id: 1, fullname: "Men", code: "M", description: "Men's garments", status: "active" },
  { id: 2, fullname: "Women", code: "W", description: "Women's garments", status: "active" },
  { id: 3, fullname: "None", code: "N", description: "No specific gender / unisex", status: "active" },
];

/**
 * Fetch all active gender definitions from tbl_genders.
 * Falls back safely to defaults if the table is empty or unavailable.
 */
async function getActiveGenders() {
  try {
    const rows = await mySqlQury(
      `SELECT id, fullname, code, description, status
       FROM tbl_genders
       WHERE LOWER(TRIM(status)) = 'active'
       ORDER BY id ASC`
    );
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: Number(r.id),
        fullname: String(r.fullname || "").trim(),
        code: String(r.code || "").trim().toUpperCase(),
        description: String(r.description || "").trim(),
        status: String(r.status || "active").trim().toLowerCase(),
      }));
    }
  } catch (err) {
    console.warn("[genderHelper] Falling back to default genders:", err.message);
  }
  return DEFAULT_GENDERS.slice();
}

/**
 * Resolve an incoming gender string (fullname, code, or legacy Male/Female alias)
 * against active rows in tbl_genders.
 */
async function resolveActiveGender(raw) {
  const active = await getActiveGenders();
  const input = String(raw || "").trim();
  const lower = input.toLowerCase();

  // Map legacy Male/Female aliases cleanly
  const alias = lower === "male" ? "men" : (lower === "female" ? "women" : lower);

  if (alias) {
    const matched = active.find(
      (g) =>
        g.fullname.toLowerCase() === alias ||
        g.code.toLowerCase() === alias
    );
    if (matched) return matched;
  }

  // Fallback to "None" / code "N" if present, else first active row
  const noneRow = active.find(
    (g) => g.fullname.toLowerCase() === "none" || g.code.toUpperCase() === "N"
  );
  return noneRow || active[0] || DEFAULT_GENDERS[2];
}

module.exports = {
  DEFAULT_GENDERS,
  getActiveGenders,
  resolveActiveGender,
};
