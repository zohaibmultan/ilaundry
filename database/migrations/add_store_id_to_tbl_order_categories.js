const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });
const { mySqlQury } = require("../../middelwer/db");

async function migrate() {
  console.log("=== Running Migration: add_store_id_to_tbl_order_categories ===");

  const cols = await mySqlQury(
    "SHOW COLUMNS FROM tbl_order_categories WHERE Field = 'store_id'"
  );

  if (cols.length === 0) {
    console.log("Adding store_id column and index to tbl_order_categories...");
    await mySqlQury(`
      ALTER TABLE tbl_order_categories
        ADD COLUMN store_id INT NOT NULL DEFAULT 1 AFTER id,
        ADD KEY idx_order_categories_store_id (store_id)
    `);
    console.log("✅ Added store_id column and idx_order_categories_store_id index.");
  } else {
    console.log("ℹ️ store_id column already exists on tbl_order_categories.");
  }

  const allCols = await mySqlQury("SHOW COLUMNS FROM tbl_order_categories");
  console.log("Current tbl_order_categories schema:");
  allCols.forEach((c) => {
    console.log(`   - ${c.Field} (${c.Type}) Null:${c.Null} Default:${c.Default} Key:${c.Key}`);
  });

  console.log("=== Migration completed successfully ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
