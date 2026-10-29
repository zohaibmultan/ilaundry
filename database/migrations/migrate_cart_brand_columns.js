const { DataFind } = require("../middelwer/databaseQurey");

(async () => {
  try {
    console.log("Checking tbl_cart_servicelist columns for brand fields...");
    const cols = await DataFind("SHOW COLUMNS FROM tbl_cart_servicelist");
    const colNames = cols.map((c) => c.Field);

    const fieldsToAdd = [
      { name: "brand_id", sql: "ADD COLUMN brand_id INT DEFAULT 0" },
      { name: "brand_label", sql: "ADD COLUMN brand_label VARCHAR(255) DEFAULT ''" },
      { name: "brand_category", sql: "ADD COLUMN brand_category VARCHAR(50) DEFAULT ''" },
      { name: "brand_upcharge_percent", sql: "ADD COLUMN brand_upcharge_percent DECIMAL(6,2) DEFAULT 0.00" },
      { name: "brand_price_multiplier", sql: "ADD COLUMN brand_price_multiplier DECIMAL(6,2) DEFAULT 1.00" },
    ];

    for (const f of fieldsToAdd) {
      if (!colNames.includes(f.name)) {
        console.log(`Adding ${f.name} to tbl_cart_servicelist...`);
        await DataFind(`ALTER TABLE tbl_cart_servicelist ${f.sql}`);
        console.log(`✅ Added ${f.name}`);
      } else {
        console.log(`ℹ️ ${f.name} already exists`);
      }
    }

    console.log("🎉 Brand columns migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
})();

