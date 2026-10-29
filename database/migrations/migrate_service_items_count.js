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
    console.log("Checking tbl_services columns...");
    const [serviceCols] = await pool.query("SHOW COLUMNS FROM tbl_services");
    const serviceColNames = serviceCols.map((c) => c.Field);

    if (!serviceColNames.includes("no_of_items")) {
      await pool.query(
        "ALTER TABLE tbl_services ADD COLUMN no_of_items INT NOT NULL DEFAULT 1"
      );
      console.log("[+] Added no_of_items to tbl_services");
    } else {
      console.log("[i] no_of_items already exists in tbl_services");
    }

    console.log("Checking tbl_cart_servicelist columns...");
    const [cartServiceCols] = await pool.query("SHOW COLUMNS FROM tbl_cart_servicelist");
    const cartServiceColNames = cartServiceCols.map((c) => c.Field);

    if (!cartServiceColNames.includes("no_of_items")) {
      await pool.query(
        "ALTER TABLE tbl_cart_servicelist ADD COLUMN no_of_items INT NOT NULL DEFAULT 1"
      );
      console.log("[+] Added no_of_items to tbl_cart_servicelist");
    } else {
      console.log("[i] no_of_items already exists in tbl_cart_servicelist");
    }

    // Verify
    const [sample] = await pool.query("SELECT id, name, no_of_items FROM tbl_services LIMIT 3");
    console.log("tbl_services sample:", sample);

    console.log("Migration completed successfully!");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
