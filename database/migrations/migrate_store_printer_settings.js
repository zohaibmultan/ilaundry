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
    console.log("Checking tbl_store columns for printer hardware settings...");
    const [storeCols] = await pool.query("SHOW COLUMNS FROM tbl_store");
    const existingCols = storeCols.map((c) => c.Field);

    const colsToAdd = [
      { name: "invoice_printer_format", def: "INT DEFAULT 1" },
      { name: "invoice_printer_name", def: "VARCHAR(255) DEFAULT ''" },
      { name: "tag_printer_format", def: "INT DEFAULT 1" },
      { name: "tag_printer_name", def: "VARCHAR(255) DEFAULT ''" },
      { name: "printing_server_url", def: "VARCHAR(255) DEFAULT 'http://127.0.0.1:4321'" },
      { name: "silent_print_enabled", def: "INT DEFAULT 1" },
      { name: "printer_auto_cut", def: "INT DEFAULT 1" },
      { name: "printer_open_cash_drawer", def: "INT DEFAULT 0" },
      { name: "printer_copies", def: "INT DEFAULT 1" }
    ];

    for (const col of colsToAdd) {
      if (!existingCols.includes(col.name)) {
        await pool.query(`ALTER TABLE tbl_store ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[+] Added column ${col.name} to tbl_store`);
      } else {
        console.log(`[i] Column ${col.name} already exists in tbl_store`);
      }
    }

    const [sample] = await pool.query("SELECT id, name, printing_server_url, invoice_printer_name FROM tbl_store LIMIT 2");
    console.log("tbl_store sample:", sample);
    console.log("Migration finished successfully!");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
