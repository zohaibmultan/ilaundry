const mysql = require("mysql2/promise");
require("dotenv").config({ path: "config.env" });

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "icleaners",
    port: process.env.DB_PORT || 3306,
  });

  try {
    console.log("Connected to database. Starting service categories migration...");

    // 1. Create tbl_service_category
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_service_category (
        id INT NOT NULL AUTO_INCREMENT,
        name VARCHAR(255) NOT NULL,
        sequence_no INT NOT NULL DEFAULT 0,
        status VARCHAR(45) NOT NULL DEFAULT '0',
        store_ID VARCHAR(45) NOT NULL DEFAULT '1',
        delete_flage VARCHAR(45) NOT NULL DEFAULT '0',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
    `);
    console.log("✓ tbl_service_category verified / created");

    // 2. Create tbl_service_subcategory
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_service_subcategory (
        id INT NOT NULL AUTO_INCREMENT,
        category_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        sequence_no INT NOT NULL DEFAULT 0,
        status VARCHAR(45) NOT NULL DEFAULT '0',
        store_ID VARCHAR(45) NOT NULL DEFAULT '1',
        delete_flage VARCHAR(45) NOT NULL DEFAULT '0',
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;
    `);
    console.log("✓ tbl_service_subcategory verified / created");

    // 3. Add category_id and subcategory_id to tbl_services if missing
    const [serviceColumns] = await connection.query("SHOW COLUMNS FROM tbl_services");
    const existingColNames = serviceColumns.map((c) => c.Field);

    if (!existingColNames.includes("category_id")) {
      await connection.query("ALTER TABLE tbl_services ADD COLUMN category_id INT DEFAULT NULL");
      console.log("✓ Added category_id column to tbl_services");
    } else {
      console.log("✓ category_id column already exists in tbl_services");
    }

    if (!existingColNames.includes("subcategory_id")) {
      await connection.query("ALTER TABLE tbl_services ADD COLUMN subcategory_id INT DEFAULT NULL");
      console.log("✓ Added subcategory_id column to tbl_services");
    } else {
      console.log("✓ subcategory_id column already exists in tbl_services");
    }

    // 4. Ensure default 'General' category exists per store
    const [stores] = await connection.query("SELECT id FROM tbl_store");
    const storeIds = new Set(stores.map((s) => String(s.id)));
    storeIds.add("1"); // always ensure fallback store 1

    for (const storeId of storeIds) {
      const [existingCats] = await connection.query(
        "SELECT id FROM tbl_service_category WHERE store_ID = ? AND delete_flage = '0' LIMIT 1",
        [storeId]
      );

      let catId;
      if (existingCats.length === 0) {
        const [insertResult] = await connection.query(
          "INSERT INTO tbl_service_category (name, sequence_no, status, store_ID, delete_flage) VALUES (?, 1, '0', ?, '0')",
          ["General", storeId]
        );
        catId = insertResult.insertId;
        console.log(`✓ Created default 'General' category (ID: ${catId}) for store ${storeId}`);
      } else {
        catId = existingCats[0].id;
      }

      // Assign existing services with null/0 category_id for this store
      await connection.query(
        "UPDATE tbl_services SET category_id = ? WHERE (category_id IS NULL OR category_id = 0) AND store_ID = ?",
        [catId, storeId]
      );
    }

    // Assign any remaining services whose store wasn't matched to the first store's category
    const [firstCat] = await connection.query("SELECT id FROM tbl_service_category WHERE delete_flage = '0' LIMIT 1");
    if (firstCat.length > 0) {
      await connection.query(
        "UPDATE tbl_services SET category_id = ? WHERE category_id IS NULL OR category_id = 0",
        [firstCat[0].id]
      );
    }

    console.log("✓ Existing services assigned to categories successfully");
    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
    throw err;
  } finally {
    await connection.end();
  }
}

runMigration().catch(() => process.exit(1));
