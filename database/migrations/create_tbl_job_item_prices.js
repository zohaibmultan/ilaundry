/**
 * Idempotent migration: create `tbl_job_item_prices` table for storing
 * per-job-type service item prices (only positive prices > 0 are persisted).
 *
 * Non-destructive and safe to re-run.
 */
const { mySqlQury } = require("../../middelwer/db");

async function runMigration() {
  console.log("=== Running Migration: create_tbl_job_item_prices ===");

  await mySqlQury(`
    CREATE TABLE IF NOT EXISTS tbl_job_item_prices (
      id INT NOT NULL AUTO_INCREMENT,
      store_id INT NOT NULL DEFAULT 1,
      job_type_id INT NOT NULL,
      service_id INT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_job_item_price (job_type_id, service_id),
      KEY idx_job_item_prices_store_id (store_id),
      KEY idx_job_item_prices_service_id (service_id),
      CONSTRAINT fk_job_item_prices_job_type
        FOREIGN KEY (job_type_id) REFERENCES tbl_job_types (id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_job_item_prices_service
        FOREIGN KEY (service_id) REFERENCES tbl_services (id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const cols = await mySqlQury("SHOW COLUMNS FROM tbl_job_item_prices");
  console.log("✅ tbl_job_item_prices verified / created with columns:");
  for (const col of cols) {
    console.log(`   - ${col.Field} (${col.Type}) null=${col.Null} key=${col.Key} default=${col.Default}`);
  }

  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
