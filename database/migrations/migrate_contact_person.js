const { DataFind } = require('../../middelwer/databaseQurey');

async function migrate() {
  try {
    const existing = await DataFind("SHOW COLUMNS FROM tbl_store LIKE 'contact_first_name'");
    if (existing.length === 0) {
      console.log("Adding contact person columns to tbl_store...");
      await DataFind(`
        ALTER TABLE tbl_store 
        ADD COLUMN contact_first_name VARCHAR(100) DEFAULT NULL AFTER name,
        ADD COLUMN contact_last_name VARCHAR(100) DEFAULT NULL AFTER contact_first_name,
        ADD COLUMN contact_phone VARCHAR(50) DEFAULT NULL AFTER contact_last_name,
        ADD COLUMN contact_email VARCHAR(150) DEFAULT NULL AFTER contact_phone
      `);
      console.log("✅ Columns contact_first_name, contact_last_name, contact_phone, contact_email added successfully!");
    } else {
      console.log("Contact person columns already exist.");
    }
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
