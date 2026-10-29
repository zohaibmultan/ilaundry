const { DataFind, DataUpdate } = require('../middelwer/databaseQurey');

async function migrate() {
  try {
    console.log("Checking tbl_customer for memo column...");
    const columns = await DataFind("SHOW COLUMNS FROM tbl_customer LIKE 'memo'");
    if (columns && columns.length > 0) {
      console.log("Column 'memo' already exists in tbl_customer.");
    } else {
      console.log("Adding column 'memo' to tbl_customer...");
      await DataFind("ALTER TABLE tbl_customer ADD COLUMN memo TEXT NULL AFTER address");
      console.log("Successfully added column 'memo' to tbl_customer.");
    }
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate();
