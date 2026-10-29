const { DataFind, DataUpdate } = require("../middelwer/databaseQurey");
const { conn } = require("../middelwer/db");

async function migrate() {
  try {
    console.log("Checking columns in tbl_master_shop and tbl_store...");
    
    // Check tbl_master_shop
    const masterCols = await DataFind("SHOW COLUMNS FROM tbl_master_shop LIKE 'ocr_server_url'");
    if (!masterCols || masterCols.length === 0) {
      console.log("Adding ocr_server_url to tbl_master_shop...");
      await new Promise((resolve, reject) => {
        conn.query(
          "ALTER TABLE tbl_master_shop ADD COLUMN ocr_server_url VARCHAR(255) DEFAULT 'http://127.0.0.1:5000/api/scan'",
          (err, res) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });
      console.log("Added ocr_server_url to tbl_master_shop.");
    } else {
      console.log("ocr_server_url already exists in tbl_master_shop.");
    }

    // Check tbl_store
    const storeCols = await DataFind("SHOW COLUMNS FROM tbl_store LIKE 'ocr_server_url'");
    if (!storeCols || storeCols.length === 0) {
      console.log("Adding ocr_server_url to tbl_store...");
      await new Promise((resolve, reject) => {
        conn.query(
          "ALTER TABLE tbl_store ADD COLUMN ocr_server_url VARCHAR(255) DEFAULT NULL",
          (err, res) => {
            if (err) return reject(err);
            resolve(res);
          }
        );
      });
      console.log("Added ocr_server_url to tbl_store.");
    } else {
      console.log("ocr_server_url already exists in tbl_store.");
    }

    console.log("Migration completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();

