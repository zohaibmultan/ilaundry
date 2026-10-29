const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../config.env") });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "icleaners",
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log("Checking tbl_master_shop columns...");
    const [masterCols] = await pool.query("SHOW COLUMNS FROM tbl_master_shop");
    const masterColNames = masterCols.map((c) => c.Field);

    if (!masterColNames.includes("ready_lead_days")) {
      await pool.query(
        "ALTER TABLE tbl_master_shop ADD COLUMN ready_lead_days INT NOT NULL DEFAULT 2"
      );
      console.log("[+] Added ready_lead_days to tbl_master_shop");
    }
    if (!masterColNames.includes("ready_cutoff_time")) {
      await pool.query(
        "ALTER TABLE tbl_master_shop ADD COLUMN ready_cutoff_time VARCHAR(10) NOT NULL DEFAULT '13:00'"
      );
      console.log("[+] Added ready_cutoff_time to tbl_master_shop");
    }
    if (!masterColNames.includes("ready_time")) {
      await pool.query(
        "ALTER TABLE tbl_master_shop ADD COLUMN ready_time VARCHAR(10) NOT NULL DEFAULT '16:00'"
      );
      console.log("[+] Added ready_time to tbl_master_shop");
    }
    if (!masterColNames.includes("ready_working_days")) {
      await pool.query(
        "ALTER TABLE tbl_master_shop ADD COLUMN ready_working_days VARCHAR(50) NOT NULL DEFAULT '1,2,3,4,5,6'"
      );
      console.log("[+] Added ready_working_days to tbl_master_shop");
    }

    console.log("Checking tbl_store columns...");
    const [storeCols] = await pool.query("SHOW COLUMNS FROM tbl_store");
    const storeColNames = storeCols.map((c) => c.Field);

    if (!storeColNames.includes("ready_lead_days")) {
      await pool.query(
        "ALTER TABLE tbl_store ADD COLUMN ready_lead_days INT NULL DEFAULT NULL"
      );
      console.log("[+] Added ready_lead_days to tbl_store");
    }
    if (!storeColNames.includes("ready_cutoff_time")) {
      await pool.query(
        "ALTER TABLE tbl_store ADD COLUMN ready_cutoff_time VARCHAR(10) NULL DEFAULT NULL"
      );
      console.log("[+] Added ready_cutoff_time to tbl_store");
    }
    if (!storeColNames.includes("ready_time")) {
      await pool.query(
        "ALTER TABLE tbl_store ADD COLUMN ready_time VARCHAR(10) NULL DEFAULT NULL"
      );
      console.log("[+] Added ready_time to tbl_store");
    }
    if (!storeColNames.includes("ready_working_days")) {
      await pool.query(
        "ALTER TABLE tbl_store ADD COLUMN ready_working_days VARCHAR(50) NULL DEFAULT NULL"
      );
      console.log("[+] Added ready_working_days to tbl_store");
    }

    // Verify
    const [masterRow] = await pool.query("SELECT id, ready_lead_days, ready_cutoff_time, ready_time, ready_working_days FROM tbl_master_shop LIMIT 1");
    console.log("tbl_master_shop sample:", masterRow[0]);

    console.log("Database migration completed successfully!");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
