const path = require('path');
const { DataFind, DataInsert } = require(path.join(__dirname, '../middelwer/databaseQurey'));

async function migrate() {
    try {
        console.log("Checking tbl_order schema...");
        const cols = await DataFind("DESCRIBE tbl_order");
        const colNames = cols.map(c => c.Field);
        if (!colNames.includes('transferred_from_store_id')) {
            console.log("Adding transferred_from_store_id column...");
            await DataFind("ALTER TABLE tbl_order ADD COLUMN transferred_from_store_id INT DEFAULT NULL");
            console.log("✅ Added transferred_from_store_id column to tbl_order");
        } else {
            console.log("✅ transferred_from_store_id column already exists");
        }

        console.log("Checking tbl_orderstatus for 'Transfer to other Store'...");
        const statusCheck = await DataFind("SELECT * FROM tbl_orderstatus WHERE status = 'Transfer to other Store'");
        if (statusCheck.length === 0) {
            console.log("Inserting new order status...");
            await DataInsert("tbl_orderstatus", "status", "'Transfer to other Store'");
            const newStatus = await DataFind("SELECT * FROM tbl_orderstatus WHERE status = 'Transfer to other Store'");
            console.log("✅ Inserted status 'Transfer to other Store':", newStatus);
        } else {
            console.log("✅ Status 'Transfer to other Store' already exists:", statusCheck[0]);
        }
    } catch (err) {
        console.error("Migration error:", err);
    }
    process.exit(0);
}

migrate();
