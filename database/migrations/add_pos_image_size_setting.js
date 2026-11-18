const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });
const { mySqlQury } = require("../../middelwer/db");

async function migrate() {
  console.log("=== Running Migration: add_pos_image_size_setting ===");

  // 1. Check & alter tbl_master_shop
  const masterCols = await mySqlQury(
    "SHOW COLUMNS FROM tbl_master_shop WHERE Field = 'pos_image_size'"
  );
  if (masterCols.length === 0) {
    console.log("Adding pos_image_size to tbl_master_shop...");
    await mySqlQury(
      "ALTER TABLE tbl_master_shop ADD COLUMN pos_image_size VARCHAR(20) NOT NULL DEFAULT 'medium'"
    );
    console.log("✅ pos_image_size added to tbl_master_shop.");
  } else {
    console.log("ℹ️ pos_image_size already exists on tbl_master_shop.");
  }

  // 2. Check & alter tbl_store
  const storeCols = await mySqlQury(
    "SHOW COLUMNS FROM tbl_store WHERE Field = 'pos_image_size'"
  );
  if (storeCols.length === 0) {
    console.log("Adding pos_image_size to tbl_store...");
    await mySqlQury(
      "ALTER TABLE tbl_store ADD COLUMN pos_image_size VARCHAR(20) NULL DEFAULT NULL"
    );
    console.log("✅ pos_image_size added to tbl_store.");
  } else {
    console.log("ℹ️ pos_image_size already exists on tbl_store.");
  }

  // 3. Verify values
  const masterVal = await mySqlQury("SELECT id, pos_image_size FROM tbl_master_shop LIMIT 1");
  console.log("Current master shop pos_image_size:", masterVal);

  console.log("=== Migration completed successfully ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
