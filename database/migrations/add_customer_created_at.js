const path = require('path');
const mysql = require(path.resolve(__dirname, '../../node_modules/mysql2/promise'));
require(path.resolve(__dirname, '../../node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../../config.env'),
});

async function migrate() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'icleaners',
    port: Number(process.env.DB_PORT) || 3306,
  });

  console.log('✅ Connected to database for customer created_at migration.');

  const [cols] = await connection.query("SHOW COLUMNS FROM tbl_customer LIKE 'created_at'");
  if (cols.length === 0) {
    console.log('Adding created_at column to tbl_customer...');
    await connection.query(
      'ALTER TABLE tbl_customer ADD COLUMN created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER approved'
    );
    console.log('✅ Added created_at column to tbl_customer.');

    // Backfill legacy customers who have earlier order history
    const [res] = await connection.query(`
      UPDATE tbl_customer c
      LEFT JOIN (
        SELECT customer_id, MIN(order_date) AS first_order_at
        FROM tbl_order
        WHERE order_date IS NOT NULL
        GROUP BY customer_id
      ) o ON CAST(o.customer_id AS UNSIGNED) = c.id
      SET c.created_at = o.first_order_at
      WHERE o.first_order_at IS NOT NULL AND o.first_order_at < c.created_at
    `);
    console.log(`✅ Backfilled registration timestamps from first order history for ${res.affectedRows} legacy customer(s).`);
  } else {
    console.log('ℹ️ created_at column already exists in tbl_customer.');
  }

  await connection.end();
  console.log('Migration complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
