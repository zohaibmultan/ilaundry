const { DataFind } = require("../middelwer/databaseQurey");

(async () => {
  try {
    console.log("Checking tbl_store columns...");
    const storeCols = await DataFind("SHOW COLUMNS FROM tbl_store");
    const storeColNames = storeCols.map((c) => c.Field);

    if (!storeColNames.includes("override_rate_percent")) {
      console.log("Adding override_rate_percent column to tbl_store...");
      await DataFind(
        "ALTER TABLE tbl_store ADD COLUMN override_rate_percent FLOAT NOT NULL DEFAULT 10"
      );
      console.log("✅ Added override_rate_percent to tbl_store");
    } else {
      console.log("ℹ️ override_rate_percent already exists in tbl_store");
    }

    console.log("Checking tbl_cart_servicelist columns...");
    const cartSvcCols = await DataFind("SHOW COLUMNS FROM tbl_cart_servicelist");
    const cartSvcColNames = cartSvcCols.map((c) => c.Field);

    if (!cartSvcColNames.includes("item_value")) {
      console.log("Adding item_value column to tbl_cart_servicelist...");
      await DataFind(
        "ALTER TABLE tbl_cart_servicelist ADD COLUMN item_value FLOAT DEFAULT 0"
      );
      console.log("✅ Added item_value to tbl_cart_servicelist");
    } else {
      console.log("ℹ️ item_value already exists in tbl_cart_servicelist");
    }

    if (!cartSvcColNames.includes("original_rate")) {
      console.log("Adding original_rate column to tbl_cart_servicelist...");
      await DataFind(
        "ALTER TABLE tbl_cart_servicelist ADD COLUMN original_rate FLOAT DEFAULT 0"
      );
      await DataFind(
        "UPDATE tbl_cart_servicelist SET original_rate = service_type_price WHERE original_rate = 0 OR original_rate IS NULL"
      );
      console.log("✅ Added original_rate to tbl_cart_servicelist and backfilled from service_type_price");
    } else {
      console.log("ℹ️ original_rate already exists in tbl_cart_servicelist");
    }

    console.log("🎉 Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
})();

