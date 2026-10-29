const mysql = require('mysql2/promise');
require('dotenv').config({ path: './config.env' });

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('--- Starting Non-Destructive Migration for Order Type & Pickup Date ---');

    // 1. Check & Add columns in tbl_cart
    const [cartCols] = await connection.query('SHOW COLUMNS FROM tbl_cart');
    const cartColNames = cartCols.map((c) => c.Field);

    if (!cartColNames.includes('order_type')) {
      console.log('Adding order_type to tbl_cart...');
      await connection.query(
        "ALTER TABLE tbl_cart ADD COLUMN order_type VARCHAR(100) NOT NULL DEFAULT 'Customer drop-off & Customer pick-up' AFTER order_id"
      );
    } else {
      console.log('tbl_cart.order_type already exists.');
    }

    if (!cartColNames.includes('pickup_date')) {
      console.log('Adding pickup_date to tbl_cart...');
      await connection.query(
        'ALTER TABLE tbl_cart ADD COLUMN pickup_date DATETIME NULL DEFAULT NULL AFTER delivery_date'
      );
    } else {
      console.log('tbl_cart.pickup_date already exists.');
    }

    // 2. Check & Add columns in tbl_order
    const [orderCols] = await connection.query('SHOW COLUMNS FROM tbl_order');
    const orderColNames = orderCols.map((c) => c.Field);

    if (!orderColNames.includes('order_type')) {
      console.log('Adding order_type to tbl_order...');
      await connection.query(
        "ALTER TABLE tbl_order ADD COLUMN order_type VARCHAR(100) NOT NULL DEFAULT 'Customer drop-off & Customer pick-up' AFTER order_id"
      );
    } else {
      console.log('tbl_order.order_type already exists.');
    }

    if (!orderColNames.includes('pickup_date')) {
      console.log('Adding pickup_date to tbl_order...');
      await connection.query(
        'ALTER TABLE tbl_order ADD COLUMN pickup_date DATETIME NULL DEFAULT NULL AFTER delivery_date'
      );
    } else {
      console.log('tbl_order.pickup_date already exists.');
    }

    // 3. Backfill tbl_order
    console.log('Backfilling tbl_order existing records...');
    await connection.query(`
      UPDATE tbl_order 
      SET order_type = 'Customer drop-off & Customer pick-up' 
      WHERE order_type IS NULL OR order_type = ''
    `);

    await connection.query(`
      UPDATE tbl_order 
      SET pickup_date = delivery_date 
      WHERE pickup_date IS NULL 
        AND delivery_date IS NOT NULL
    `);

    // 4. Backfill tbl_cart
    console.log('Backfilling tbl_cart existing records...');
    await connection.query(`
      UPDATE tbl_cart 
      SET order_type = 'Customer drop-off & Customer pick-up' 
      WHERE order_type IS NULL OR order_type = ''
    `);

    await connection.query(`
      UPDATE tbl_cart 
      SET pickup_date = delivery_date 
      WHERE pickup_date IS NULL 
        AND delivery_date IS NOT NULL
    `);

    console.log('--- Migration Finished Successfully ---');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await connection.end();
  }
}

runMigration().catch((err) => {
  process.exit(1);
});
