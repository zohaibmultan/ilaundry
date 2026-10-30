const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');
const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../config.env') });

async function seedCustomers() {
  const conn = await mysql.createConnection({
    host: (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim(),
    port: Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306,
    user: (process.env.DB_USER || 'root').replace(/['"]/g, '').trim(),
    password: process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '',
    database: (process.env.DB_NAME || 'icleaners').replace(/['"]/g, '').trim(),
  });

  const dummyCustomers = [
    { first: 'John', last: 'Smith', phone: '2125550101', email: 'john.smith@example.com', type: 'Counter & Counter', store: '19', addr: '120 Broadway', city: 'New York', state: 'NY', zip: '10005', memo: 'Prefers light starch on shirts.' },
    { first: 'Emma', last: 'Johnson', phone: '2125550102', email: 'emma.j@example.com', type: 'Counter & Route', store: '19', addr: '450 Lexington Ave', city: 'New York', state: 'NY', zip: '10017', memo: 'Leave with doorman if not home.' },
    { first: 'Michael', last: 'Williams', phone: '2125550103', email: 'm.williams@example.com', type: 'Route & Route', store: '19', addr: '78 W 85th St Apt 4B', city: 'New York', state: 'NY', zip: '10024', memo: 'Call 10 minutes before delivery.' },
    { first: 'Sophia', last: 'Brown', phone: '2125550104', email: 'sophia.b@example.com', type: 'Route & Counter', store: '19', addr: '150 Central Park South', city: 'New York', state: 'NY', zip: '10019', memo: 'Delicate silk garments, handle with care.' },
    { first: 'James', last: 'Jones', phone: '2125550105', email: 'james.jones@example.com', type: 'Counter & Counter', store: '19', addr: '350 5th Ave', city: 'New York', state: 'NY', zip: '10118', memo: 'Eco-friendly detergent only.' },
    { first: 'Olivia', last: 'Garcia', phone: '7185550201', email: 'olivia.g@example.com', type: 'Counter & Counter', store: '20', addr: '250 Joralemon St', city: 'Brooklyn', state: 'NY', zip: '11201', memo: 'VIP customer. Express wash preferred.' },
    { first: 'William', last: 'Miller', phone: '7185550202', email: 'w.miller@example.com', type: 'Counter & Route', store: '20', addr: '789 Franklin Ave', city: 'Brooklyn', state: 'NY', zip: '11238', memo: 'Ring bell #3 on arrival.' },
    { first: 'Ava', last: 'Davis', phone: '7185550203', email: 'ava.davis@example.com', type: 'Route & Route', store: '20', addr: '320 Bedford Ave', city: 'Brooklyn', state: 'NY', zip: '11249', memo: 'Pickup from side porch box.' },
    { first: 'Benjamin', last: 'Rodriguez', phone: '7185550204', email: 'ben.rodriguez@example.com', type: 'Route & Counter', store: '20', addr: '512 Court St', city: 'Brooklyn', state: 'NY', zip: '11231', memo: 'Suits and coats on wooden hangers.' },
    { first: 'Mia', last: 'Martinez', phone: '7185550205', email: 'mia.m@example.com', type: 'Counter & Counter', store: '20', addr: '104 Montague St', city: 'Brooklyn', state: 'NY', zip: '11201', memo: 'Extra rinse cycle.' }
  ];

  try {
    console.log('--- Seeding 10 Dummy Customers ---');
    const salt = bcrypt.genSaltSync(10);

    for (const c of dummyCustomers) {
      const [existing] = await conn.query('SELECT id FROM tbl_customer WHERE number = ? OR username = ?', [c.phone, c.phone]);
      const combinedName = `${c.last}, ${c.first}`;

      if (existing && existing.length > 0) {
        console.log(`[EXISTS] ${combinedName} (${c.phone}). Updating status...`);
        await conn.query('UPDATE tbl_customer SET delet_flage = 0, approved = 1 WHERE id = ?', [existing[0].id]);
      } else {
        const hashed = bcrypt.hashSync(c.phone, salt);
        await conn.query(`
          INSERT INTO tbl_customer (
            name, first_name, last_name, number, email, address, city, state, zipcode,
            customer_type, memo, taxnumber, username, password, store_ID, reffstore,
            main_roll_id, approved, delet_flage
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          combinedName, c.first, c.last, c.phone, c.email, c.addr, c.city, c.state, c.zip,
          c.type, c.memo, '', c.phone, hashed, c.store, c.store,
          3, 1, 0
        ]);
        console.log(`[ADDED] ✅ ${combinedName} (${c.phone}) - Store ${c.store} [${c.type}]`);
      }
    }

    // Ensure all active customers have delet_flage = 0
    await conn.query('UPDATE tbl_customer SET delet_flage = 0 WHERE approved = 1');

    const [rows] = await conn.query('SELECT COUNT(*) as count FROM tbl_customer WHERE delet_flage = 0');
    console.log(`--- Seeding Complete: ${rows[0].count} active customers available in system ---`);

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err.message);
    await conn.end();
    process.exit(1);
  }
}

seedCustomers();

