const mysql = require('mysql');
const bcrypt = require('bcrypt');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'config.env') });

const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'icleaners',
  port: process.env.DB_PORT || 3306,
  multipleStatements: true
});

function query(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

async function runCleanup() {
  console.log('🚀 Starting Database Cleanup on database: ' + (process.env.DB_NAME || 'icleaners'));

  // 1. Generate hashes for standard passwords
  const adminPasswordHash = await bcrypt.hash('12344556', 10);
  const storePasswordHash = await bcrypt.hash('123', 10);

  console.log('--- Step 1: Wiping Operational / Transactional Tables ---');
  const tablesToTruncate = [
    'tbl_order',
    'tbl_order_payment',
    'tbl_cart',
    'tbl_cart_servicelist',
    'tbl_customer',
    'tbl_expense',
    'tbl_transections',
    'tbl_notification',
    'tbl_coupon',
    'tbl_commision',
    'tbl_email'
  ];

  await query('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tablesToTruncate) {
    await query(`TRUNCATE TABLE \`${table}\``);
    console.log(`  ✓ Truncated ${table}`);
  }

  console.log('--- Step 2: Cleaning Stores (Retaining 1 Default Store: Store 4 / Main Branch) ---');
  await query('DELETE FROM tbl_store WHERE id != 4');
  await query(`
    UPDATE tbl_store 
    SET name = 'Main Branch',
        username = 'store1',
        password = ?,
        mobile_number = '+1-555-0199',
        store_email = 'store1@laundry.com',
        address = '100 Main Street, Suite 1',
        city = 'Los Angeles',
        state = 'CA',
        country = 'USA',
        zipcode = '90001',
        status = '1',
        delete_flage = '0'
    WHERE id = 4
  `, [storePasswordHash]);
  console.log('  ✓ Updated Store 4 to "Main Branch" (username: store1, password: 123) and removed test stores');

  console.log('--- Step 3: Cleaning Accounts (Resetting balances to $0.00) ---');
  await query('DELETE FROM tbl_account WHERE id NOT IN (7, 8, 10)');
  await query(`
    UPDATE tbl_account 
    SET ac_name = 'Cash Counter / Drawer',
        ac_number = 'CASH-001',
        ac_decrip = 'Front counter cash register',
        store_ID = '4',
        balance = 0.00,
        store_name = 'Main Branch',
        delet_flage = '0'
    WHERE id = 7
  `);
  await query(`
    UPDATE tbl_account 
    SET ac_name = 'Main Operating Account',
        ac_number = 'BANK-001',
        ac_decrip = 'Commercial checking account',
        store_ID = '4',
        balance = 0.00,
        store_name = 'Main Branch',
        delet_flage = '0'
    WHERE id = 8
  `);
  await query(`
    UPDATE tbl_account 
    SET ac_name = 'Company Master Account',
        ac_number = 'MST-001',
        ac_decrip = 'Master operational account',
        store_ID = '',
        balance = 0.00,
        store_name = 'master',
        delet_flage = '0'
    WHERE id = 10
  `);
  console.log('  ✓ Preserved 3 accounts (Cash, Bank, Master) and reset balances to $0.00');

  console.log('--- Step 4: Cleaning Admins & Staff ---');
  await query('DELETE FROM tbl_admin WHERE id NOT IN (1, 11)');
  await query(`
    UPDATE tbl_admin 
    SET name = 'Super Admin',
        username = 'admin',
        email = 'admin@laundry.com',
        password = ?,
        store_ID = '',
        roll_id = '12',
        is_staff = '0',
        approved = '1',
        delet_flage = '0'
    WHERE id = 1
  `, [adminPasswordHash]);
  await query(`
    UPDATE tbl_admin 
    SET name = 'Main Branch Manager',
        username = 'store1',
        email = 'store1@laundry.com',
        password = ?,
        store_ID = '4',
        roll_id = '13',
        is_staff = '0',
        approved = '1',
        delet_flage = '0'
    WHERE id = 11
  `, [storePasswordHash]);
  console.log('  ✓ Preserved Super Admin (admin / 12344556) and Store Admin (store1 / 123)');

  console.log('--- Step 5: Cleaning Staff Permissions (tbl_staff_roll) ---');
  await query('DELETE FROM tbl_staff_roll WHERE staff_id NOT IN (1, 2) AND main_roll_id NOT IN (12, 13)');
  console.log('  ✓ Cleaned orphan staff permissions');

  console.log('--- Step 6: Cleaning Service Catalog & Expense Types for Deleted Stores ---');
  await query("DELETE FROM tbl_services WHERE store_ID NOT IN ('4', '')");
  await query("DELETE FROM tbl_services_type WHERE store_ID NOT IN ('4', '')");
  await query("DELETE FROM tbl_addons WHERE store_ID NOT IN ('4', '')");
  await query("DELETE FROM tbl_exp_cat_type WHERE store_ID NOT IN ('4', '')");
  await query("DELETE FROM tbl_exp_cat WHERE store_ID NOT IN ('4', '')");
  console.log('  ✓ Retained clean starter service catalog and expense types for Store 4 and Master');

  console.log('--- Step 7: Verifying Master Shop Settings ---');
  await query(`
    UPDATE tbl_master_shop 
    SET storeroll = 12
    WHERE id = 1
  `);
  console.log('  ✓ Verified tbl_master_shop settings');

  await query('SET FOREIGN_KEY_CHECKS = 1');

  console.log('\n--- Summary Table Row Counts ---');
  const summaryTables = [
    'tbl_admin', 'tbl_store', 'tbl_account', 'tbl_roll', 'tbl_orderstatus',
    'tbl_services_type', 'tbl_services', 'tbl_addons', 'tbl_exp_cat_type', 'tbl_exp_cat',
    'tbl_order', 'tbl_order_payment', 'tbl_cart', 'tbl_customer', 'tbl_expense', 'tbl_transections', 'tbl_notification'
  ];
  for (const t of summaryTables) {
    const res = await query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
    console.log(`  ${t.padEnd(22)}: ${res[0].cnt} rows`);
  }

  console.log('\n✅ Database cleanup completed successfully!');
  pool.end();
}

runCleanup().catch(err => {
  console.error('❌ Error during cleanup:', err);
  pool.end();
  process.exit(1);
});
