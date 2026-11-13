/**
 * Idempotent Migration: Communication Preferences Table & Customer Column
 * Creates `tbl_communication_preferences` and seeds default values:
 * - Print
 * - Email
 * - SMS
 * - Chat
 * Adds `communication_preference_id` and `sms_opt_in` to `tbl_customer`
 */
const path = require("path");
const mysql = require(path.resolve(__dirname, "../../node_modules/mysql2/promise"));
require(path.resolve(__dirname, "../../node_modules/dotenv")).config({
  path: path.resolve(__dirname, "../../config.env"),
});

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "127.0.0.1",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "icleaners",
    port: Number(process.env.DB_PORT) || 3306,
  });

  try {
    console.log("🚀 Starting Non-Destructive Migration for Communication Preferences...");

    // 1. Create tbl_communication_preferences table
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_communication_preferences (
        id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(30) NOT NULL UNIQUE,
        name VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NULL DEFAULT NULL,
        sort_order INT NOT NULL DEFAULT 1,
        status TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("✅ Verified / Created table `tbl_communication_preferences`");

    // 2. Seed initial canonical preferences (Print, Email, SMS, Chat)
    const initialPrefs = [
      { code: "print", name: "Print", sort_order: 1, description: "Printed paper receipts and counter tickets" },
      { code: "email", name: "Email", sort_order: 2, description: "Digital receipts and order status emails" },
      { code: "sms", name: "SMS", sort_order: 3, description: "Automated mobile SMS alerts for order updates" },
      { code: "chat", name: "Chat", sort_order: 4, description: "Instant WhatsApp and direct chat updates" },
    ];

    for (const pref of initialPrefs) {
      await connection.query(
        `INSERT INTO tbl_communication_preferences (code, name, description, sort_order, status)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE 
           name = VALUES(name),
           description = VALUES(description),
           sort_order = VALUES(sort_order),
           status = 1`,
        [pref.code, pref.name, pref.description, pref.sort_order]
      );
    }
    console.log("✅ Seeded canonical communication preferences (Print, Email, SMS, Chat)");

    // 3. Check and add columns in tbl_customer
    const [cols] = await connection.query("SHOW COLUMNS FROM tbl_customer");
    const existingCols = cols.map((c) => c.Field.toLowerCase());

    if (!existingCols.includes("communication_preference_id")) {
      console.log("➕ Adding column `communication_preference_id` to tbl_customer...");
      await connection.query(`
        ALTER TABLE tbl_customer
        ADD COLUMN communication_preference_id INT NULL DEFAULT NULL AFTER customer_type,
        ADD INDEX idx_customer_comm_pref (communication_preference_id)
      `);
      console.log("✅ Added `communication_preference_id` with index to tbl_customer");
    } else {
      console.log("ℹ️ Column `communication_preference_id` already exists in tbl_customer");
    }

    if (!existingCols.includes("sms_opt_in")) {
      console.log("➕ Adding column `sms_opt_in` to tbl_customer...");
      await connection.query(`
        ALTER TABLE tbl_customer
        ADD COLUMN sms_opt_in TINYINT(1) NOT NULL DEFAULT 0 AFTER communication_preference_id
      `);
      console.log("✅ Added `sms_opt_in` to tbl_customer");
    } else {
      console.log("ℹ️ Column `sms_opt_in` already exists in tbl_customer");
    }

    // 4. Verify results
    const [rows] = await connection.query("SELECT * FROM tbl_communication_preferences ORDER BY sort_order ASC");
    console.log("📋 Current communication preferences:", rows);

    console.log("🎉 Migration for Communication Preferences completed successfully!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigration();
