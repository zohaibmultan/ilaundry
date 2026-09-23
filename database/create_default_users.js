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

async function createDefaultUsers() {
  console.log('🚀 Creating Default Users with Password: "123456" for database: ' + (process.env.DB_NAME || 'icleaners'));
  const passwordHash = await bcrypt.hash('123456', 10);

  // 1. Ensure Roles in tbl_roll
  // Check Master (12), Store (13), Customer (14), Order Delete (15)
  let cashierRoll = await query("SELECT * FROM tbl_roll WHERE roll = 'Cashier'");
  let cashierRollId;
  if (!cashierRoll || cashierRoll.length === 0) {
    const res = await query(`
      INSERT INTO tbl_roll (roll, rollType, orders, expense, service, reports, tools, mail, master, sms, staff, pos, customers, master_setting, branch_n_store, Pay_Out, account, coupon, rollaccess, roll_status, delet_flage)
      VALUES ('Cashier', 'store', 'read,edit', '', 'read', 'read', '', '', '', '', '', 'read,write', 'read,write,edit', '', '', '', '', 'read', '', 'active', '0')
    `);
    cashierRollId = res.insertId;
    console.log(`  ✓ Created 'Cashier' role in tbl_roll with ID: ${cashierRollId}`);
  } else {
    cashierRollId = cashierRoll[0].id;
    console.log(`  ✓ 'Cashier' role exists in tbl_roll with ID: ${cashierRollId}`);
  }

  // 2. Clean existing staff/admin users
  await query("SET FOREIGN_KEY_CHECKS = 0");
  await query("DELETE FROM tbl_admin");
  await query("DELETE FROM tbl_staff_roll");
  await query("DELETE FROM tbl_customer");

  // 3. User 1: Admin (Super Admin)
  const adminAdmin = await query(`
    INSERT INTO tbl_admin (id, name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff)
    VALUES (1, 'Admin', '+1-800-555-0100', 'admin@laundry.com', 'admin', ?, '', '1', '1', '0', '0')
  `, [passwordHash]);

  await query(`
    INSERT INTO tbl_staff_roll (id, pos, orders, customers, coupon, expense, service, branch_n_store, staff, sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out, account, main_roll_id, staff_id, is_staff)
    VALUES (1, 'read,write', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit', 'read,write,edit,delete', 'read,write,edit,delete', 'read,edit', 'read,edit', 'read', 'read', 'read,edit', 'read,edit', 'read', 'read,write,edit,delete', '12', '1', '0')
  `);
  console.log('  ✓ Created User 1: Admin (username: admin, role: Master)');

  // 4. User 2: Manager (Main Store Manager)
  const managerAdmin = await query(`
    INSERT INTO tbl_admin (id, name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff)
    VALUES (2, 'Manager', '+1-310-555-0167', 'manager@laundry.com', 'manager', ?, '4', '2', '1', '0', '0')
  `, [passwordHash]);

  await query(`
    INSERT INTO tbl_staff_roll (id, pos, orders, customers, coupon, expense, service, branch_n_store, staff, sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out, account, main_roll_id, staff_id, is_staff)
    VALUES (2, 'read,write,edit', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', '', 'read,write,edit,delete', 'read,write,edit,delete', 'read,edit', '', 'read', 'read', 'read,edit', 'read,edit', '', 'read,write,edit,delete', '13', '2', '0')
  `);

  // Update tbl_store id 4 to link to manager
  await query(`
    UPDATE tbl_store 
    SET name = 'Main Store',
        username = 'manager',
        password = ?,
        admin_id = '2'
    WHERE id = 4
  `, [passwordHash]);
  console.log('  ✓ Created User 2: Manager (username: manager, role: Store Manager for Main Store)');

  // 5. User 3: Order Delete
  const orderDeleteAdmin = await query(`
    INSERT INTO tbl_admin (id, name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff)
    VALUES (3, 'Order Delete', '+1-310-555-0168', 'orderdelete@laundry.com', 'orderdelete', ?, '4', '3', '1', '0', '1')
  `, [passwordHash]);

  await query(`
    INSERT INTO tbl_staff_roll (id, pos, orders, customers, coupon, expense, service, branch_n_store, staff, sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out, account, main_roll_id, staff_id, is_staff)
    VALUES (3, 'read,write', 'read,delete', 'read', '', '', '', '', '', '', '', '', 'read', '', '', '', '', '', '15', '3', '1')
  `);
  console.log('  ✓ Created User 3: Order Delete (username: orderdelete, role: Order Delete)');

  // 6. User 4: Cashier
  const cashierAdmin = await query(`
    INSERT INTO tbl_admin (id, name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff)
    VALUES (4, 'Cashier', '+1-310-555-0169', 'cashier@laundry.com', 'cashier', ?, '4', '4', '1', '0', '1')
  `, [passwordHash]);

  await query(`
    INSERT INTO tbl_staff_roll (id, pos, orders, customers, coupon, expense, service, branch_n_store, staff, sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out, account, main_roll_id, staff_id, is_staff)
    VALUES (4, 'read,write', 'read,edit', 'read,write,edit', 'read', '', 'read', '', '', '', '', '', 'read', '', '', '', '', '', '${cashierRollId}', '4', '1')
  `);
  console.log(`  ✓ Created User 4: Cashier (username: cashier, role: Cashier)`);

  // 7. User 5: Customer
  await query(`
    INSERT INTO tbl_customer (id, name, number, email, address, taxnumber, username, password, store_ID, main_roll_id, reffstore, approved, delet_flage)
    VALUES (1, 'Customer', '+1-310-555-0199', 'customer@laundry.com', '123 Laundry Lane, Los Angeles, CA', 'TAX-CUST-001', 'customer', ?, '4', '14', '4', '1', '0')
  `, [passwordHash]);
  console.log('  ✓ Created User 5: Customer (username: customer, role: Customer)');

  await query("SET FOREIGN_KEY_CHECKS = 1");

  console.log('\n--- Verification of Created Users ---');
  const admins = await query("SELECT a.id, a.name, a.username, a.store_ID, a.roll_id, a.is_staff, r.roll as role_name FROM tbl_admin a JOIN tbl_staff_roll sr ON a.roll_id = sr.id JOIN tbl_roll r ON sr.main_roll_id = r.id");
  for (const a of admins) {
    const valid = await bcrypt.compare('123456', (await query('SELECT password FROM tbl_admin WHERE id = ?', [a.id]))[0].password);
    console.log(`  Staff/Admin [${a.name}]: username="${a.username}", role="${a.role_name}", store_ID="${a.store_ID}", password_valid=${valid}`);
  }

  const cust = await query("SELECT id, name, username, store_ID, password FROM tbl_customer WHERE username = 'customer'");
  if (cust.length > 0) {
    const valid = await bcrypt.compare('123456', cust[0].password);
    console.log(`  Customer [${cust[0].name}]: username="${cust[0].username}", store_ID="${cust[0].store_ID}", password_valid=${valid}`);
  }

  pool.end();
}

createDefaultUsers().catch(err => {
  console.error('❌ Error creating users:', err);
  pool.end();
  process.exit(1);
});
