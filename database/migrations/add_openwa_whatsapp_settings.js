/**
 * Idempotent Migration: Open-WA WhatsApp Gateway & Notification Channels
 * - Adds `whatsapp_enabled` column to `tbl_notification_settings`
 * - Adds `openwa_*` configuration columns to `tbl_master_shop` and `tbl_store`
 * - Seeds `tbl_master_shop` (id = 1) with default Open-WA gateway settings from config.env
 */
const path = require("path");
const mysql = require(path.resolve(__dirname, "../../node_modules/mysql2/promise"));
require(path.resolve(__dirname, "../../node_modules/dotenv")).config({
  path: path.resolve(__dirname, "../../config.env"),
});

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "icleaners",
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log("✅ Connected to database for Open-WA WhatsApp migration.");

  // 1. Ensure tbl_notification_settings exists and add whatsapp_enabled column
  await connection.query(`
    CREATE TABLE IF NOT EXISTS tbl_notification_settings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      store_id INT NOT NULL DEFAULT 0,
      email_enabled TINYINT(1) NOT NULL DEFAULT 1,
      sms_enabled TINYINT(1) NOT NULL DEFAULT 1,
      whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1,
      push_enabled TINYINT(1) NOT NULL DEFAULT 1,
      events_config LONGTEXT NULL,
      templates_config LONGTEXT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY idx_notif_store_id (store_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const [notifCols] = await connection.query("SHOW COLUMNS FROM tbl_notification_settings");
  const notifColNames = notifCols.map((c) => c.Field);
  if (!notifColNames.includes("whatsapp_enabled")) {
    await connection.query(
      "ALTER TABLE tbl_notification_settings ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER sms_enabled"
    );
    console.log("✅ Added whatsapp_enabled to tbl_notification_settings.");
  } else {
    console.log("ℹ️ whatsapp_enabled already exists in tbl_notification_settings.");
  }

  // 2. Add Open-WA gateway columns to tbl_master_shop and tbl_store
  const gatewayCols = [
    { name: "openwa_base_url", def: "VARCHAR(255) NULL DEFAULT NULL" },
    { name: "openwa_api_key", def: "VARCHAR(255) NULL DEFAULT NULL" },
    { name: "openwa_session_id", def: "VARCHAR(120) NULL DEFAULT NULL" },
    { name: "openwa_country_code", def: "VARCHAR(10) NULL DEFAULT '1'" },
    { name: "openwa_status", def: "TINYINT(1) NOT NULL DEFAULT 1" },
  ];

  for (const tableName of ["tbl_master_shop", "tbl_store"]) {
    const [cols] = await connection.query(`SHOW COLUMNS FROM ${tableName}`);
    const existing = cols.map((c) => c.Field);
    for (const col of gatewayCols) {
      if (!existing.includes(col.name)) {
        await connection.query(`ALTER TABLE ${tableName} ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added ${col.name} to ${tableName}.`);
      } else {
        console.log(`ℹ️ ${col.name} already exists in ${tableName}.`);
      }
    }
  }

  // 3. Seed tbl_master_shop (id = 1) if Open-WA values are empty and configured in config.env
  const defaultBaseUrl = (process.env.OPENWA_BASE_URL || "").trim().replace(/\/+$/, "");
  const defaultApiKey = (process.env.OPENWA_API_KEY || "").trim();
  const defaultSession = (process.env.OPENWA_SESSION_ID || "i-cleaners").trim();
  const defaultCountryCode = (process.env.OPENWA_DEFAULT_COUNTRY_CODE || "1").trim();

  const [masterRows] = await connection.query(
    "SELECT id, openwa_base_url, openwa_api_key, openwa_session_id, openwa_country_code FROM tbl_master_shop WHERE id = 1 LIMIT 1"
  );

  if (masterRows.length > 0) {
    const m = masterRows[0];
    await connection.query(
      `UPDATE tbl_master_shop
       SET openwa_base_url = COALESCE(NULLIF(openwa_base_url, ''), ?),
           openwa_api_key = COALESCE(NULLIF(openwa_api_key, ''), ?),
           openwa_session_id = COALESCE(NULLIF(openwa_session_id, ''), ?),
           openwa_country_code = COALESCE(NULLIF(openwa_country_code, ''), ?),
           openwa_status = COALESCE(openwa_status, 1)
       WHERE id = 1`,
      [
        m.openwa_base_url || defaultBaseUrl,
        m.openwa_api_key || defaultApiKey,
        m.openwa_session_id || defaultSession,
        m.openwa_country_code || defaultCountryCode,
      ]
    );
    console.log("✅ Seeded default Open-WA gateway config on tbl_master_shop (id=1).");
  }

  await connection.end();
  console.log("Migration complete.");
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
