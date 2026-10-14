const { DataFind } = require("./databaseQurey");

/**
 * Generates the next sequential order ID for a given store.
 * Format: [PREFIX][6-digit-sequence] (e.g. A100001, B100032).
 * Default start sequence is 100001.
 *
 * @param {string|number} storeId - Store ID to retrieve prefix and compute sequence.
 * @returns {Promise<string>} Next order ID string.
 */
async function generateOrderId(storeId) {
  let prefix = "A";
  if (storeId && String(storeId) !== "0" && String(storeId).trim() !== "") {
    const storeRow = await DataFind(
      `SELECT order_prefix FROM tbl_store WHERE id = '${storeId}'`,
    );
    if (
      storeRow &&
      storeRow.length > 0 &&
      storeRow[0].order_prefix &&
      storeRow[0].order_prefix.trim()
    ) {
      prefix = storeRow[0].order_prefix.trim().toUpperCase();
    }
  }

  // Find the highest existing order number for this store and prefix
  const storeCondition =
    storeId && String(storeId) !== "0" && String(storeId).trim() !== ""
      ? `store_id = '${storeId}' AND `
      : "";

  const sql = `
    SELECT order_id FROM tbl_order 
    WHERE ${storeCondition} order_id LIKE '${prefix}%'
    ORDER BY CAST(SUBSTRING(order_id, ${prefix.length + 1}) AS UNSIGNED) DESC 
    LIMIT 1
  `;
  const latest = await DataFind(sql);

  let nextNum = 100001;
  if (latest && latest.length > 0 && latest[0].order_id) {
    const numPart = parseInt(latest[0].order_id.substring(prefix.length), 10);
    if (!isNaN(numPart) && numPart >= 100001) {
      nextNum = numPart + 1;
    } else if (!isNaN(numPart)) {
      nextNum = Math.max(100001, numPart + 1);
    }
  }

  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

module.exports = {
  generateOrderId,
};
