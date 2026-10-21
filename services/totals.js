/**
 * Standardized Totals & Tax Calculation Engine for iCleaners
 *
 * Canonical Business Rule: Pre-Tax Discount
 * 1. Taxable Base = Math.max(0, sub_total + addon_price - coupon_discount - extra_discount)
 * 2. Tax Amount   = ROUND(Taxable Base * (tax_rate / 100), 2)
 * 3. Gross Total  = ROUND(Taxable Base + Tax Amount, 2)
 * 4. Balance      = ROUND(Gross Total - paid_amount, 2)
 */

const { DataFind, DataUpdate } = require('../middelwer/databaseQurey');

/**
 * Pure calculation function. Computes totals given input numeric fields.
 *
 * @param {Object} input
 * @param {number} [input.sub_total=0]
 * @param {number} [input.addon_price=0]
 * @param {number} [input.coupon_discount=0]
 * @param {number} [input.extra_discount=0]
 * @param {number} [input.tax=0] Percentage rate, e.g. 5 for 5%
 * @param {number} [input.paid_amount=0]
 * @returns {Object} Standardized calculated fields rounded to 2 decimals
 */
function calculateTotals({
  sub_total = 0,
  addon_price = 0,
  coupon_discount = 0,
  extra_discount = 0,
  tax = 0,
  paid_amount = 0
} = {}) {
  const sub = Math.max(0, Number(sub_total) || 0);
  const addon = Math.max(0, Number(addon_price) || 0);
  const coupon = Math.max(0, Number(coupon_discount) || 0);
  const extra = Math.max(0, Number(extra_discount) || 0);
  const taxRate = Math.max(0, Number(tax) || 0);
  const paid = Math.max(0, Number(paid_amount) || 0);

  // Pre-tax discount formula: discount reduces the taxable base before applying tax
  const taxableBase = Math.max(0, Math.round((sub + addon - coupon - extra) * 100) / 100);
  const taxAmount = Math.round((taxableBase * (taxRate / 100)) * 100) / 100;
  const grossTotal = Math.round((taxableBase + taxAmount) * 100) / 100;
  const balance = Math.round((grossTotal - paid) * 100) / 100;

  return {
    sub_total: Number(sub.toFixed(2)),
    addon_price: Number(addon.toFixed(2)),
    coupon_discount: Number(coupon.toFixed(2)),
    extra_discount: Number(extra.toFixed(2)),
    taxable_base: Number(taxableBase.toFixed(2)),
    tax_rate: Number(taxRate.toFixed(2)),
    tax_amount: Number(taxAmount.toFixed(2)),
    gross_total: Number(grossTotal.toFixed(2)),
    paid_amount: Number(paid.toFixed(2)),
    balance: Number(balance.toFixed(2))
  };
}

/**
 * Recalculates and persists totals for an active order record.
 * Also synchronizes store commission.
 *
 * @param {number|string} orderId Order primary key
 * @param {string} [hostname='localhost']
 * @param {string} [protocol='http']
 * @returns {Promise<Object|null>} The updated order object or null if not found
 */
async function recalculateOrderTotals(orderId, hostname = 'localhost', protocol = 'http') {
  const orders = await DataFind('SELECT * FROM tbl_order WHERE id = ?', [orderId]);
  if (!orders || orders.length === 0) return null;
  const order = orders[0];

  const totals = calculateTotals({
    sub_total: order.sub_total,
    addon_price: order.addon_price,
    coupon_discount: order.coupon_discount,
    extra_discount: order.extra_discount,
    tax: order.tax,
    paid_amount: order.paid_amount
  });

  let masterCommission = 0;
  if (order.store_id) {
    const stores = await DataFind('SELECT shop_commission FROM tbl_store WHERE id = ?', [order.store_id]);
    const commissionRate = (stores && stores.length > 0) ? (Number(stores[0].shop_commission) || 0) : 0;
    masterCommission = Math.round(((totals.gross_total * commissionRate) / 100) * 100) / 100;
  }

  const setClause = `
    sub_total = ${totals.sub_total},
    addon_price = ${totals.addon_price},
    coupon_discount = ${totals.coupon_discount},
    extra_discount = ${totals.extra_discount},
    tax_amount = ${totals.tax_amount},
    gross_total = ${totals.gross_total},
    balance_amount = ${totals.balance},
    master_comission = ${masterCommission}
  `;

  await DataUpdate('tbl_order', setClause, `id = '${orderId}'`, hostname, protocol);

  const updatedOrders = await DataFind('SELECT * FROM tbl_order WHERE id = ?', [orderId]);
  return updatedOrders && updatedOrders.length > 0 ? updatedOrders[0] : null;
}

/**
 * Recalculates and persists totals for an active cart record.
 *
 * @param {string} createdBy Cart identifier (e.g. "1,4" or "staff,2")
 * @param {string} [hostname='localhost']
 * @param {string} [protocol='http']
 * @returns {Promise<Object|null>}
 */
async function recalculateCartTotals(createdBy, hostname = 'localhost', protocol = 'http') {
  const carts = await DataFind('SELECT * FROM tbl_cart WHERE created_by = ?', [createdBy]);
  if (!carts || carts.length === 0) return null;
  const cart = carts[0];

  const totals = calculateTotals({
    sub_total: cart.sub_total,
    addon_price: cart.addon_price,
    coupon_discount: cart.coupon_discount,
    extra_discount: cart.extra_discount,
    tax: cart.tax,
    paid_amount: cart.paid_amount
  });

  const setClause = `
    sub_total = ${totals.sub_total},
    addon_price = ${totals.addon_price},
    coupon_discount = ${totals.coupon_discount},
    extra_discount = ${totals.extra_discount},
    tax_amount = ${totals.tax_amount},
    gross_total = ${totals.gross_total},
    balance = ${totals.balance}
  `;

  await DataUpdate('tbl_cart', setClause, `created_by = '${createdBy}'`, hostname, protocol);

  const updatedCarts = await DataFind('SELECT * FROM tbl_cart WHERE created_by = ?', [createdBy]);
  return updatedCarts && updatedCarts.length > 0 ? updatedCarts[0] : null;
}

module.exports = {
  calculateTotals,
  recalculateOrderTotals,
  recalculateCartTotals
};
