const { mySqlQury } = require('../../middelwer/db');

async function migrateRouteScheduling() {
    console.log('🚀 Starting Route Scheduling & Ready Date Database Migration...');

    try {
        // 1. Check & add ready_date to tbl_cart
        const cartCols = await mySqlQury('SHOW COLUMNS FROM tbl_cart');
        const cartHasReady = cartCols.some(c => c.Field === 'ready_date');
        if (!cartHasReady) {
            console.log('➕ Adding ready_date column to tbl_cart...');
            await mySqlQury('ALTER TABLE tbl_cart ADD COLUMN ready_date TIMESTAMP NULL AFTER order_date');
            console.log('✅ ready_date added to tbl_cart');
        } else {
            console.log('ℹ️ ready_date already exists in tbl_cart');
        }

        // 2. Check & add ready_date to tbl_order
        const orderCols = await mySqlQury('SHOW COLUMNS FROM tbl_order');
        const orderHasReady = orderCols.some(c => c.Field === 'ready_date');
        if (!orderHasReady) {
            console.log('➕ Adding ready_date column to tbl_order...');
            await mySqlQury('ALTER TABLE tbl_order ADD COLUMN ready_date TIMESTAMP NULL AFTER order_date');
            console.log('✅ ready_date added to tbl_order');
        } else {
            console.log('ℹ️ ready_date already exists in tbl_order');
        }

        // 3. Backfill ready_date in tbl_order from delivery_date where ready_date IS NULL
        console.log('🔄 Backfilling ready_date from delivery_date in tbl_order...');
        const backfillRes = await mySqlQury('UPDATE tbl_order SET ready_date = delivery_date WHERE ready_date IS NULL AND delivery_date IS NOT NULL');
        console.log(`✅ Backfilled ready_date for ${backfillRes.affectedRows || 0} existing order records.`);

        // 4. Backfill ready_date in tbl_cart
        await mySqlQury('UPDATE tbl_cart SET ready_date = delivery_date WHERE ready_date IS NULL AND delivery_date IS NOT NULL');
        console.log('✅ Backfilled ready_date in tbl_cart.');

        console.log('🎉 Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    }
}

migrateRouteScheduling();
