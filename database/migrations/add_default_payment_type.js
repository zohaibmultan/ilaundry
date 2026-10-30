const { DataFind } = require('../../middelwer/databaseQurey');
const { conn } = require('../../middelwer/db');

/**
 * Migration: Add default_payment_type column to tbl_master_shop and tbl_store.
 */
async function migrate() {
  const promiseConn = conn.promise();

  try {
    console.log('--- Checking schema for default_payment_type ---');

    // 1. tbl_master_shop
    const masterCols = await DataFind('SHOW COLUMNS FROM tbl_master_shop');
    const masterFields = masterCols.map(c => c.Field);
    if (!masterFields.includes('default_payment_type')) {
      console.log("[ADDING] default_payment_type to tbl_master_shop...");
      await promiseConn.query("ALTER TABLE tbl_master_shop ADD COLUMN default_payment_type VARCHAR(50) NULL DEFAULT 'Cash'");
      console.log("[SUCCESS] default_payment_type added to tbl_master_shop.");
    } else {
      console.log("[SKIP] default_payment_type already exists on tbl_master_shop.");
    }

    // 2. tbl_store
    const storeCols = await DataFind('SHOW COLUMNS FROM tbl_store');
    const storeFields = storeCols.map(c => c.Field);
    if (!storeFields.includes('default_payment_type')) {
      console.log("[ADDING] default_payment_type to tbl_store...");
      await promiseConn.query("ALTER TABLE tbl_store ADD COLUMN default_payment_type VARCHAR(50) NULL DEFAULT NULL");
      console.log("[SUCCESS] default_payment_type added to tbl_store.");
    } else {
      console.log("[SKIP] default_payment_type already exists on tbl_store.");
    }

    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

