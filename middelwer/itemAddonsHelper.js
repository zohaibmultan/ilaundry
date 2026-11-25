const { mySqlQury } = require("./db");
const { DataFind, DataUpdate } = require("./databaseQurey");

/**
 * Safely parse tbl_cart_servicelist.addons_json into a normalized array:
 * [{ id, name, price, default_price }]
 */
function parseItemAddons(raw) {
  if (!raw) return [];
  let parsed = raw;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "0" || trimmed === "null") return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch (_) {
      return [];
    }
  }
  if (!Array.isArray(parsed)) return [];
  const out = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const id = parseInt(item.id, 10) || 0;
    const name = String(item.name || item.addon || "").trim();
    if (!name) continue;
    const price = Math.max(0, Number(Number(item.price || 0).toFixed(2)));
    const defaultPrice = Math.max(
      0,
      Number(Number(item.default_price !== undefined ? item.default_price : price).toFixed(2))
    );
    out.push({ id, name, price, default_price: defaultPrice });
  }
  return out;
}

/**
 * Compute per-unit addon sum and line addon total (unitTotal * qty).
 */
function calculateItemAddonLineTotal(addonsList, qty) {
  const list = Array.isArray(addonsList) ? addonsList : parseItemAddons(addonsList);
  const safeQty = Math.max(0, Number(qty) || 0);
  let unitTotal = 0;
  for (const ad of list) {
    unitTotal += Math.max(0, Number(ad.price) || 0);
  }
  unitTotal = Number(unitTotal.toFixed(2));
  const lineTotal = Number((unitTotal * safeQty).toFixed(2));
  return { unitTotal, lineTotal };
}

/**
 * Format compact display metadata for POS cart rows:
 * shows up to 2 addon names and hides remaining count (+N).
 */
function formatItemAddonsShort(addonsList, maxVisible = 2) {
  const list = Array.isArray(addonsList) ? addonsList : parseItemAddons(addonsList);
  const visible = list.slice(0, maxVisible).map((a) => a.name);
  const hiddenCount = Math.max(0, list.length - maxVisible);
  const tooltip = list
    .map((a) => `${a.name} ($${Number(a.price || 0).toFixed(2)})`)
    .join(", ");
  return {
    count: list.length,
    visibleNames: visible,
    hiddenCount,
    labelText: visible.join(", "),
    tooltip,
  };
}

/**
 * Parse comma-separated service_list IDs cleanly.
 */
function parseIdList(csv) {
  return String(csv || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Recompute total item-level addon_price for a cart and sync tbl_cart totals.
 * Uses canonical pre-tax discount formula.
 */
async function recalcCartAddonAndTotals(createdByKey, hostname = "localhost", protocol = "http") {
  const carts = await mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]);
  if (!carts || carts.length === 0) return null;
  const cart = carts[0];

  const itemIds = parseIdList(cart.service_list_id);
  let totalAddonPrice = 0;

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => "?").join(",");
    const rows = await mySqlQury(
      `SELECT id, service_quntity, addons_json, addon_price FROM tbl_cart_servicelist WHERE id IN (${placeholders})`,
      itemIds
    );
    for (const row of rows || []) {
      const parsed = parseItemAddons(row.addons_json);
      if (parsed.length > 0) {
        const { lineTotal } = calculateItemAddonLineTotal(parsed, row.service_quntity || 1);
        totalAddonPrice += lineTotal;
      } else if (Number(row.addon_price) > 0) {
        totalAddonPrice += Number(row.addon_price) || 0;
      }
    }
  }

  totalAddonPrice = Number(totalAddonPrice.toFixed(2));
  const subTotal = Math.max(0, Number(cart.sub_total) || 0);
  const couponDiscount = Math.max(0, Number(cart.coupon_discount) || 0);
  const extraDiscount = Math.max(0, Number(cart.extra_discount) || 0);
  const taxRate = Math.max(0, Number(cart.tax) || 0);
  const paidAmount = Math.max(0, Number(cart.paid_amount) || 0);

  const taxableBase = Math.max(0, Number((subTotal + totalAddonPrice - couponDiscount - extraDiscount).toFixed(2)));
  const taxAmount = Number((taxableBase * (taxRate / 100)).toFixed(2));
  const grossTotal = Number((taxableBase + taxAmount).toFixed(2));
  const balance = Number((grossTotal - paidAmount).toFixed(2));

  await DataUpdate(
    "tbl_cart",
    `addon_id = '0',
     addon_price = ${totalAddonPrice},
     tax_amount = ${taxAmount},
     gross_total = ${grossTotal},
     balance = ${balance}`,
    `created_by = '${String(createdByKey).replace(/'/g, "''")}'`,
    hostname,
    protocol
  );

  const updated = await mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]);
  return updated && updated.length > 0 ? updated[0] : null;
}

/**
 * Recompute total item-level addon_price for an existing order (Edit Order mode)
 * and sync tbl_order totals & master commission.
 */
async function recalcOrderAddonAndTotals(orderId, hostname = "localhost", protocol = "http") {
  const cleanOrderId = parseInt(orderId, 10);
  if (!Number.isInteger(cleanOrderId) || cleanOrderId <= 0) return null;

  const orders = await mySqlQury("SELECT * FROM tbl_order WHERE id = ? LIMIT 1", [cleanOrderId]);
  if (!orders || orders.length === 0) return null;
  const order = orders[0];

  const itemIds = parseIdList(order.service_list);
  let totalAddonPrice = 0;
  let hasAnyItemAddons = false;

  if (itemIds.length > 0) {
    const placeholders = itemIds.map(() => "?").join(",");
    const rows = await mySqlQury(
      `SELECT id, service_quntity, addons_json, addon_price FROM tbl_cart_servicelist WHERE id IN (${placeholders})`,
      itemIds
    );
    for (const row of rows || []) {
      const parsed = parseItemAddons(row.addons_json);
      if (parsed.length > 0) {
        hasAnyItemAddons = true;
        const { lineTotal } = calculateItemAddonLineTotal(parsed, row.service_quntity || 1);
        totalAddonPrice += lineTotal;
      } else if (Number(row.addon_price) > 0) {
        hasAnyItemAddons = true;
        totalAddonPrice += Number(row.addon_price) || 0;
      }
    }
  }

  // If this is a legacy order with order-level addon_data and no item-level addons touched, keep legacy addon_price only if explicitly preserved
  totalAddonPrice = Number(totalAddonPrice.toFixed(2));
  const subTotal = Math.max(0, Number(order.sub_total) || 0);
  const couponDiscount = Math.max(0, Number(order.coupon_discount) || 0);
  const extraDiscount = Math.max(0, Number(order.extra_discount) || 0);
  const taxRate = Math.max(0, Number(order.tax) || 0);
  const paidAmount = Math.max(0, Number(order.paid_amount) || 0);

  const taxableBase = Math.max(0, Number((subTotal + totalAddonPrice - couponDiscount - extraDiscount).toFixed(2)));
  const taxAmount = Number((taxableBase * (taxRate / 100)).toFixed(2));
  const grossTotal = Number((taxableBase + taxAmount).toFixed(2));
  const balanceAmount = Number((grossTotal - paidAmount).toFixed(2));

  let shopCommission = 0;
  if (order.store_id) {
    const storeRows = await DataFind(`SELECT shop_commission FROM tbl_store WHERE id = '${order.store_id}' LIMIT 1`);
    shopCommission = storeRows && storeRows[0] ? Number(storeRows[0].shop_commission) || 0 : 0;
  }
  const masterCommission = Number(((grossTotal * shopCommission) / 100).toFixed(2));

  await DataUpdate(
    "tbl_order",
    `addon_data = '0',
     addon_price = ${totalAddonPrice},
     tax_amount = ${taxAmount},
     gross_total = ${grossTotal},
     balance_amount = ${balanceAmount},
     master_comission = ${masterCommission}`,
    `id = '${cleanOrderId}'`,
    hostname,
    protocol
  );

  const updated = await mySqlQury("SELECT * FROM tbl_order WHERE id = ? LIMIT 1", [cleanOrderId]);
  return updated && updated.length > 0 ? updated[0] : null;
}

module.exports = {
  parseItemAddons,
  calculateItemAddonLineTotal,
  formatItemAddonsShort,
  parseIdList,
  recalcCartAddonAndTotals,
  recalcOrderAddonAndTotals,
};
