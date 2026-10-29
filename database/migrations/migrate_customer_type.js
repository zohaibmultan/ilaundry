const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('--- Starting Non-Destructive Migration for Customer Type ---');

    // 1. Create tbl_customer_type table
    console.log('Checking/creating tbl_customer_type table...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_customer_type (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        status INT NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Seed initial canonical customer types
    const initialTypes = [
      'Counter & Counter',
      'Counter & Delivery',
      'Pick-up & Delivery',
      'Pick-up & Counter'
    ];

    for (const typeName of initialTypes) {
      await connection.query(
        'INSERT IGNORE INTO tbl_customer_type (name, status) VALUES (?, 1)',
        [typeName]
      );
    }
    console.log('Seeded canonical customer types into tbl_customer_type.');

    // 3. Check and Add customer_type column in tbl_customer
    const [custCols] = await connection.query('SHOW COLUMNS FROM tbl_customer');
    const custColNames = custCols.map((c) => c.Field);

    if (!custColNames.includes('customer_type')) {
      console.log('Adding customer_type column to tbl_customer...');
      await connection.query(`
        ALTER TABLE tbl_customer 
        ADD COLUMN customer_type VARCHAR(100) NOT NULL DEFAULT 'Counter & Counter' AFTER address
      `);
      console.log('Added customer_type column to tbl_customer.');
    } else {
      console.log('tbl_customer.customer_type column already exists.');
    }

    // 4. Backfill existing customers
    const [updateResult] = await connection.query(`
      UPDATE tbl_customer 
      SET customer_type = 'Counter & Counter' 
      WHERE customer_type IS NULL OR customer_type = ''
    `);
    console.log(`Backfilled ${updateResult.affectedRows || 0} customer records.`);

    // 5. Verification
    const [types] = await connection.query('SELECT * FROM tbl_customer_type ORDER BY id ASC');
    console.log('tbl_customer_type rows:', types);

    const [sampleCust] = await connection.query('SELECT id, name, customer_type FROM tbl_customer LIMIT 5');
    console.log('Sample tbl_customer rows:', sampleCust);

    console.log('--- Migration for Customer Type completed successfully! ---');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
