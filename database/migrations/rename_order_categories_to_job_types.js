/**
 * Idempotent migration:
 * 1. Rename `tbl_order_categories` -> `tbl_job_types` (or create `tbl_job_types` if missing)
 *    and normalize index / foreign key names.
 * 2. Copy non-deleted data from `tbl_service_category` (as root job types) and
 *    `tbl_service_subcategory` (as child job types) into `tbl_job_types`.
 *
 * Non-destructive & safe to re-run (skips rows that already exist).
 */
const { mySqlQury } = require("../../middelwer/db");

async function tableExists(tableName) {
  const rows = await mySqlQury("SHOW TABLES LIKE ?", [tableName]);
  return rows && rows.length > 0;
}

async function runMigration() {
  console.log("=== Running Migration: rename_order_categories_to_job_types ===");

  const hasOldTable = await tableExists("tbl_order_categories");
  const hasNewTable = await tableExists("tbl_job_types");

  if (hasOldTable && !hasNewTable) {
    console.log("Renaming table tbl_order_categories -> tbl_job_types...");
    await mySqlQury("RENAME TABLE tbl_order_categories TO tbl_job_types");
    console.log("✅ Renamed tbl_order_categories to tbl_job_types.");
  } else if (!hasOldTable && !hasNewTable) {
    console.log("Creating table tbl_job_types...");
    await mySqlQury(`
      CREATE TABLE IF NOT EXISTS tbl_job_types (
        id INT NOT NULL AUTO_INCREMENT,
        store_id INT NOT NULL DEFAULT 1,
        parent_id INT NULL DEFAULT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        image VARCHAR(255) NULL DEFAULT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        PRIMARY KEY (id),
        KEY idx_job_types_store_id (store_id),
        KEY idx_job_types_parent_id (parent_id),
        KEY idx_job_types_status (status),
        CONSTRAINT fk_job_types_parent
          FOREIGN KEY (parent_id) REFERENCES tbl_job_types (id)
          ON DELETE CASCADE ON UPDATE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log("✅ Created tbl_job_types.");
  } else {
    console.log("ℹ️ tbl_job_types already exists.");
  }

  // Normalize old FK / index names if present
  const fks = await mySqlQury(
    `SELECT CONSTRAINT_NAME
     FROM information_schema.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'tbl_job_types'
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
  );
  const fkNames = new Set((fks || []).map((r) => r.CONSTRAINT_NAME));
  if (fkNames.has("fk_order_categories_parent")) {
    await mySqlQury("ALTER TABLE tbl_job_types DROP FOREIGN KEY fk_order_categories_parent");
    console.log("✅ Dropped old FK fk_order_categories_parent.");
  }

  const indexes = await mySqlQury("SHOW INDEX FROM tbl_job_types");
  const idxNames = new Set((indexes || []).map((r) => r.Key_name));

  const indexRenames = [
    ["idx_order_categories_store_id", "idx_job_types_store_id"],
    ["idx_order_categories_parent_id", "idx_job_types_parent_id"],
    ["idx_order_categories_status", "idx_job_types_status"],
  ];

  for (const [oldIdx, newIdx] of indexRenames) {
    if (idxNames.has(oldIdx) && !idxNames.has(newIdx)) {
      await mySqlQury(`ALTER TABLE tbl_job_types RENAME INDEX ${oldIdx} TO ${newIdx}`);
      console.log(`✅ Renamed index ${oldIdx} -> ${newIdx}.`);
    }
  }

  if (!fkNames.has("fk_job_types_parent")) {
    await mySqlQury(`
      ALTER TABLE tbl_job_types
      ADD CONSTRAINT fk_job_types_parent
      FOREIGN KEY (parent_id) REFERENCES tbl_job_types (id)
      ON DELETE CASCADE ON UPDATE CASCADE
    `);
    console.log("✅ Added FK fk_job_types_parent.");
  }

  // Copy data from tbl_service_category and tbl_service_subcategory
  const hasSvcCat = await tableExists("tbl_service_category");
  const hasSvcSub = await tableExists("tbl_service_subcategory");

  const oldCatIdToNewId = new Map();
  let insertedCategories = 0;
  let skippedCategories = 0;
  let insertedSubcategories = 0;
  let skippedSubcategories = 0;

  if (hasSvcCat) {
    const categories = await mySqlQury(
      `SELECT id, name, sequence_no, status, store_ID, delete_flage
       FROM tbl_service_category
       WHERE delete_flage = '0'
       ORDER BY CAST(store_ID AS UNSIGNED) ASC, sequence_no ASC, id ASC`
    );

    for (const cat of categories) {
      const storeId = Number(cat.store_ID) || 1;
      const name = String(cat.name || "").trim();
      if (!name) continue;
      // In tbl_service_category, status '0' = active, '1' = inactive
      const status = String(cat.status) === "0" ? "active" : "inactive";

      const existing = await mySqlQury(
        `SELECT id FROM tbl_job_types
         WHERE store_id = ? AND parent_id IS NULL AND name = ?
         LIMIT 1`,
        [storeId, name]
      );

      if (existing && existing.length > 0) {
        oldCatIdToNewId.set(Number(cat.id), Number(existing[0].id));
        skippedCategories++;
      } else {
        const result = await mySqlQury(
          `INSERT INTO tbl_job_types (store_id, parent_id, name, description, image, status)
           VALUES (?, NULL, ?, NULL, NULL, ?)`,
          [storeId, name, status]
        );
        oldCatIdToNewId.set(Number(cat.id), Number(result.insertId));
        insertedCategories++;
      }
    }
  } else {
    console.log("⚠️ tbl_service_category not found — skipping root category copy.");
  }

  if (hasSvcSub) {
    const subcategories = await mySqlQury(
      `SELECT id, category_id, name, sequence_no, status, store_ID, delete_flage
       FROM tbl_service_subcategory
       WHERE delete_flage = '0'
       ORDER BY CAST(store_ID AS UNSIGNED) ASC, category_id ASC, sequence_no ASC, id ASC`
    );

    for (const sub of subcategories) {
      const storeId = Number(sub.store_ID) || 1;
      const name = String(sub.name || "").trim();
      if (!name) continue;
      const parentId = oldCatIdToNewId.get(Number(sub.category_id)) || null;
      // In tbl_service_subcategory, status '0' = active, '1' = inactive
      const status = String(sub.status) === "0" ? "active" : "inactive";

      const existing = parentId !== null
        ? await mySqlQury(
            `SELECT id FROM tbl_job_types
             WHERE store_id = ? AND parent_id = ? AND name = ?
             LIMIT 1`,
            [storeId, parentId, name]
          )
        : await mySqlQury(
            `SELECT id FROM tbl_job_types
             WHERE store_id = ? AND parent_id IS NULL AND name = ?
             LIMIT 1`,
            [storeId, name]
          );

      if (existing && existing.length > 0) {
        skippedSubcategories++;
      } else {
        await mySqlQury(
          `INSERT INTO tbl_job_types (store_id, parent_id, name, description, image, status)
           VALUES (?, ?, ?, NULL, NULL, ?)`,
          [storeId, parentId, name, status]
        );
        insertedSubcategories++;
      }
    }
  } else {
    console.log("⚠️ tbl_service_subcategory not found — skipping subcategory copy.");
  }

  const totalRows = await mySqlQury("SELECT COUNT(*) AS cnt FROM tbl_job_types");
  console.log(
    `✅ Migration complete: inserted ${insertedCategories} root job types (${skippedCategories} skipped), ` +
    `${insertedSubcategories} sub-job types (${skippedSubcategories} skipped). ` +
    `Total rows in tbl_job_types: ${totalRows[0].cnt}.`
  );
  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
