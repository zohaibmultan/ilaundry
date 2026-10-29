const { DataFind } = require('../../middelwer/databaseQurey');
const { conn } = require('../../middelwer/db');

async function migrate() {
  try {
    console.log('Checking tbl_order schema for void columns...');
    const cols = await DataFind('SHOW COLUMNS FROM tbl_order');
    const existing = cols.map(c => c.Field);

    const promiseConn = conn.promise();

    if (!existing.includes('void_reason')) {
      console.log('Adding void_reason column to tbl_order...');
      await promiseConn.query(`ALTER TABLE tbl_order ADD COLUMN void_reason VARCHAR(255) NULL DEFAULT NULL AFTER note`);
      console.log('Added void_reason successfully.');
    } else {
      console.log('void_reason column already exists.');
    }

    if (!existing.includes('voided_by')) {
      console.log('Adding voided_by column to tbl_order...');
      await promiseConn.query(`ALTER TABLE tbl_order ADD COLUMN voided_by VARCHAR(100) NULL DEFAULT NULL AFTER void_reason`);
      console.log('Added voided_by successfully.');
    } else {
      console.log('voided_by column already exists.');
    }

    console.log('Migration finished successfully.');
    process.exit(0);
  } catch (err) {
    console.error('Migration error:', err.message);
    process.exit(1);
  }
}

migrate();
