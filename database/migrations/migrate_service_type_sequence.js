const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../config.env") });

// Idempotent: adds tbl_services_type.sequence_no and backfills per store (by id order)
// only for stores whose rows are all still 0. Never drops or overwrites set values.
async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_DATABASE || "icleaners",
    connectionLimit: 5,
  });

  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM tbl_services_type");
    if (!cols.map((c) => c.Field).includes("sequence_no")) {
      await pool.query(
        "ALTER TABLE tbl_services_type ADD COLUMN sequence_no INT NOT NULL DEFAULT 0"
      );
      console.log("[+] Added sequence_no to tbl_services_type");
    } else {
      console.log("[i] sequence_no already exists");
    }

    const [stores] = await pool.query(
      "SELECT store_ID, MAX(sequence_no) AS mx FROM tbl_services_type GROUP BY store_ID"
    );
    for (const s of stores) {
      if (Number(s.mx) > 0) continue; // already sequenced
      const [rows] = await pool.query(
        "SELECT id FROM tbl_services_type WHERE store_ID <=> ? ORDER BY id ASC",
        [s.store_ID]
      );
      let n = 1;
      for (const r of rows) {
        await pool.query("UPDATE tbl_services_type SET sequence_no = ? WHERE id = ?", [n++, r.id]);
      }
      console.log(`[+] Backfilled store ${s.store_ID}: ${rows.length} types`);
    }

    const [sample] = await pool.query(
      "SELECT id, store_ID, services_type, sequence_no FROM tbl_services_type ORDER BY store_ID, sequence_no LIMIT 10"
    );
    console.table(sample);
    console.log("Migration completed successfully!");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
