const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../config.env') });
const { generateOrderId } = require('../../middelwer/orderIdHelper');

async function resetOrdersAndPayments() {
  const conn = await mysql.createConnection({
    host: (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim(),
    port: Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306,
    user: (process.env.DB_USER || 'root').replace(/['"]/g, '').trim(),
    password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '',
    database: (process.env.DB_NAME || 'icleaners').replace(/['"]/g, '').trim(),
  });

  try {
    console.log('--- Starting Reset of Orders and Payments ---');

    // 1. Delete all orders
    const [delOrders] = await conn.query('DELETE FROM tbl_order');
    await conn.query('ALTER TABLE tbl_order AUTO_INCREMENT = 1');
    console.log(`✅ Deleted ${delOrders.affectedRows} orders from tbl_order (AUTO_INCREMENT reset to 1).`);

    // 2. Delete all order payments
    const [delPayments] = await conn.query('DELETE FROM tbl_order_payment');
    await conn.query('ALTER TABLE tbl_order_payment AUTO_INCREMENT = 1');
    console.log(`✅ Deleted ${delPayments.affectedRows} payments from tbl_order_payment (AUTO_INCREMENT reset to 1).`);

    // 3. Delete all payment transactions ledger
    const [delTrans] = await conn.query('DELETE FROM tbl_transections');
    await conn.query('ALTER TABLE tbl_transections AUTO_INCREMENT = 1');
    console.log(`✅ Deleted ${delTrans.affectedRows} transactions from tbl_transections (AUTO_INCREMENT reset to 1).`);

    // 4. Reset all payment accounts to zero balance
    const [updAccounts] = await conn.query('UPDATE tbl_account SET balance = 0');
    console.log(`✅ Reset balance to 0 on ${updAccounts.affectedRows} payment accounts in tbl_account.`);

    // 5. Delete order notifications
    const [delNotifs] = await conn.query('DELETE FROM tbl_notification');
    await conn.query('ALTER TABLE tbl_notification AUTO_INCREMENT = 1');
    console.log(`✅ Deleted ${delNotifs.affectedRows} order notifications from tbl_notification (AUTO_INCREMENT reset to 1).`);

    // 6. Delete active cart service line items
    const [delCartItems] = await conn.query('DELETE FROM tbl_cart_servicelist');
    await conn.query('ALTER TABLE tbl_cart_servicelist AUTO_INCREMENT = 1');
    console.log(`✅ Deleted ${delCartItems.affectedRows} line items from tbl_cart_servicelist (AUTO_INCREMENT reset to 1).`);

    // 7. Reset all active carts and assign fresh sequential order IDs
    const [carts] = await conn.query('SELECT * FROM tbl_cart');
    for (const c of carts) {
      const storeId = c.store_id || '1';
      const freshOrderId = await generateOrderId(storeId);
      await conn.query(`
        UPDATE tbl_cart SET
          order_id = ?,
          order_date = CURRENT_TIMESTAMP,
          service_list_id = '0',
          addon_id = '0',
          addon_price = 0,
          sub_total = 0,
          tax_amount = 0,
          extra_discount = 0,
          coupon_id = 0,
          coupon_discount = 0,
          gross_total = 0,
          paid_amount = 0,
          balance = 0,
          payment_type = 0,
          notes = '',
          customer_id = 0,
          order_type = 'Counter & Counter'
        WHERE id = ?
      `, [freshOrderId, c.id]);
      console.log(`✅ Reset cart (ID: ${c.id}, user: ${c.created_by}, store: ${storeId}) with fresh order_id: ${freshOrderId}`);
    }

    console.log('--- Reset of Orders and Payments Completed Successfully ---');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Reset error:', err.message);
    await conn.end();
    process.exit(1);
  }
}

resetOrdersAndPayments();

