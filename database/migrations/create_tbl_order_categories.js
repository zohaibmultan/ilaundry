const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });
const { mySqlQury } = require("../../middelwer/db");

async function migrate() {
  console.log("=== Running Migration: create_tbl_order_categories ===");

  await mySqlQury(`
    CREATE TABLE IF NOT EXISTS tbl_order_categories (
      id INT NOT NULL AUTO_INCREMENT,
      store_id INT NOT NULL DEFAULT 1,
      parent_id INT NULL DEFAULT NULL,
      name VARCHAR(255) NOT NULL,
      description TEXT NULL,
      image VARCHAR(255) NULL DEFAULT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'active',
      PRIMARY KEY (id),
      KEY idx_order_categories_store_id (store_id),
      KEY idx_order_categories_parent_id (parent_id),
      KEY idx_order_categories_status (status),
      CONSTRAINT fk_order_categories_parent
        FOREIGN KEY (parent_id) REFERENCES tbl_order_categories (id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  const cols = await mySqlQury("SHOW COLUMNS FROM tbl_order_categories");
  console.log("✅ tbl_order_categories verified / created with columns:");
  cols.forEach((c) => {
    console.log(`   - ${c.Field} (${c.Type}) Null:${c.Null} Default:${c.Default} Key:${c.Key}`);
  });

  console.log("=== Migration completed successfully ===");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
