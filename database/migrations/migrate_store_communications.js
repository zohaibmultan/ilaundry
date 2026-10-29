const mysql = require("mysql2/promise");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../config.env") });

async function migrate() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "icleaners",
    waitForConnections: true,
    connectionLimit: 5,
  });

  try {
    console.log("Checking tbl_store columns for communication gateway settings...");
    const [storeCols] = await pool.query("SHOW COLUMNS FROM tbl_store");
    const existingCols = storeCols.map((c) => c.Field);

    const colsToAdd = [
      { name: "onesignal_app_id", def: "VARCHAR(255) DEFAULT ''" },
      { name: "onesignal_api_key", def: "VARCHAR(255) DEFAULT ''" },
      { name: "twilio_sid", def: "VARCHAR(255) DEFAULT ''" },
      { name: "twilio_auth_token", def: "VARCHAR(255) DEFAULT ''" },
      { name: "twilio_phone_no", def: "VARCHAR(255) DEFAULT ''" }
    ];

    for (const col of colsToAdd) {
      if (!existingCols.includes(col.name)) {
        await pool.query(`ALTER TABLE tbl_store ADD COLUMN ${col.name} ${col.def}`);
        console.log(`[+] Added column ${col.name} to tbl_store`);
      } else {
        console.log(`[i] Column ${col.name} already exists in tbl_store`);
      }
    }

    // Copy initial master credentials as initial defaults if empty in store
    const [masterRows] = await pool.query("SELECT onesignal_app_id, onesignal_api_key, twilio_sid, twilio_auth_token, twilio_phone_no FROM tbl_master_shop WHERE id=1");
    if (masterRows.length > 0) {
      const m = masterRows[0];
      await pool.query(`
        UPDATE tbl_store 
        SET 
          onesignal_app_id = COALESCE(NULLIF(onesignal_app_id, ''), ?),
          onesignal_api_key = COALESCE(NULLIF(onesignal_api_key, ''), ?),
          twilio_sid = COALESCE(NULLIF(twilio_sid, ''), ?),
          twilio_auth_token = COALESCE(NULLIF(twilio_auth_token, ''), ?),
          twilio_phone_no = COALESCE(NULLIF(twilio_phone_no, ''), ?)
      `, [m.onesignal_app_id || '', m.onesignal_api_key || '', m.twilio_sid || '', m.twilio_auth_token || '', m.twilio_phone_no || '']);
      console.log("[+] Seeded existing master communication keys to tbl_store records");
    }

    const [sample] = await pool.query("SELECT id, name, onesignal_app_id, twilio_sid FROM tbl_store LIMIT 2");
    console.log("tbl_store sample after migration:", sample);
    console.log("Communication columns migration completed successfully!");
  } finally {
    await pool.end();
  }
}

migrate().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
