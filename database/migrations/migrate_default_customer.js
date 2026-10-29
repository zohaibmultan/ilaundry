const { DataFind } = require('../middelwer/databaseQurey');

async function migrate() {
  try {
    const cols = await DataFind("SHOW COLUMNS FROM tbl_store LIKE 'default_customer_enabled'");
    if (cols.length === 0) {
      console.log("Adding default_customer_enabled column to tbl_store...");
      await DataFind("ALTER TABLE tbl_store ADD COLUMN default_customer_enabled TINYINT(1) NOT NULL DEFAULT 1");
      console.log("✅ Column added successfully!");
    } else {
      console.log("Column default_customer_enabled already exists.");
    }
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
