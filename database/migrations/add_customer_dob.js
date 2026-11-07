const path = require('path');
const mysql = require(path.resolve(__dirname, '../../node_modules/mysql2/promise'));
require(path.resolve(__dirname, '../../node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../../config.env')
});

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'icleaners',
    port: process.env.DB_PORT || 3306
  });

  console.log('✅ Connected to database for customer dob migration.');

  // Check if dob column exists in tbl_customer
  const [cols] = await connection.query("SHOW COLUMNS FROM tbl_customer LIKE 'dob'");
  if (cols.length === 0) {
    console.log('Adding dob column to tbl_customer...');
    await connection.query("ALTER TABLE tbl_customer ADD COLUMN dob DATE NULL DEFAULT NULL AFTER last_name");
    console.log('✅ Added dob column to tbl_customer successfully.');
  } else {
    console.log('ℹ️ dob column already exists in tbl_customer.');
  }

  await connection.end();
  console.log('Migration complete.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

