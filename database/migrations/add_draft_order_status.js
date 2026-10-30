const { DataFind } = require('../../middelwer/databaseQurey');
const { conn } = require('../../middelwer/db');

/**
 * Migration: Add 'Draft' status (id: 8) to tbl_orderstatus if not present.
 */
async function migrate() {
  const promiseConn = conn.promise();

  try {
    console.log('--- Checking tbl_orderstatus for Draft status ---');
    const existing = await DataFind("SELECT * FROM tbl_orderstatus WHERE status = 'Draft' OR id = 8");

    if (existing && existing.length > 0) {
      console.log(`[SKIP] Draft status already exists (id: ${existing[0].id}, status: '${existing[0].status}')`);
    } else {
      console.log("[ADDING] Inserting 'Draft' status with id: 8 into tbl_orderstatus...");
      await promiseConn.query("INSERT INTO tbl_orderstatus (id, status) VALUES (8, 'Draft')");
      console.log("[SUCCESS] 'Draft' status (id: 8) inserted into tbl_orderstatus.");
    }

    console.log('--- Migration Finished Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();

