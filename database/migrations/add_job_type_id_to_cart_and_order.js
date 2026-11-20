/**
 * Idempotent migration: add nullable `job_type_id` column and index to
 * `tbl_cart` and `tbl_order` for POS-2 job-type driven ordering.
 *
 * Non-destructive and safe to re-run.
 */
const { mySqlQury } = require("../../middelwer/db");

async function ensureJobTypeColumn(tableName, indexName) {
  const cols = await mySqlQury(
    `SHOW COLUMNS FROM ${tableName} WHERE Field = 'job_type_id'`
  );
  if (!cols || cols.length === 0) {
    console.log(`Adding job_type_id column and ${indexName} index to ${tableName}...`);
    await mySqlQury(`
      ALTER TABLE ${tableName}
        ADD COLUMN job_type_id INT NULL DEFAULT NULL,
        ADD KEY ${indexName} (job_type_id)
    `);
    console.log(`✅ Added job_type_id to ${tableName}.`);
  } else {
    console.log(`ℹ️ job_type_id already exists on ${tableName}.`);
  }
}

async function runMigration() {
  console.log("=== Running Migration: add_job_type_id_to_cart_and_order ===");
  await ensureJobTypeColumn("tbl_cart", "idx_cart_job_type_id");
  await ensureJobTypeColumn("tbl_order", "idx_order_job_type_id");
  console.log("✅ Migration complete.");
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
