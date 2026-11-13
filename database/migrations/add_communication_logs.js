const path = require('path');
const mysql = require(path.resolve(__dirname, '../../node_modules/mysql2/promise'));
require(path.resolve(__dirname, '../../node_modules/dotenv')).config({
  path: path.resolve(__dirname, '../../config.env'),
});

async function migrate() {
  console.log('--- Starting Migration: tbl_communication_logs ---');

  const dbHost = (process.env.DB_HOST || '127.0.0.1').replace(/['"]/g, '').trim();
  const dbPort = Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306;
  const dbUser = (process.env.DB_USER || 'root').replace(/['"]/g, '').trim();
  const dbPassword = process.env.DB_PASSWORD !== undefined
    ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '')
    : '';
  const dbName = (process.env.DB_NAME || 'icleaners').replace(/['"]/g, '').trim();

  const connection = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    console.log(`Connected to MySQL: ${dbHost}:${dbPort}/${dbName}`);

    // Create tbl_communication_logs table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS tbl_communication_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id INT NOT NULL DEFAULT 0,
        order_id INT NULL DEFAULT NULL,
        order_code VARCHAR(60) NULL DEFAULT NULL,
        customer_id INT NULL DEFAULT NULL,
        customer_name VARCHAR(150) NULL DEFAULT NULL,
        preference_id INT NULL DEFAULT NULL,
        preference_code VARCHAR(30) NULL DEFAULT NULL,
        event_key VARCHAR(60) NOT NULL DEFAULT 'order_placed',
        channel VARCHAR(20) NOT NULL,
        dispatch_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
        recipient VARCHAR(150) NULL DEFAULT NULL,
        subject VARCHAR(255) NULL DEFAULT NULL,
        message_preview TEXT NULL,
        status VARCHAR(20) NOT NULL,
        provider VARCHAR(40) NULL DEFAULT NULL,
        provider_message_id VARCHAR(150) NULL DEFAULT NULL,
        error_message VARCHAR(500) NULL DEFAULT NULL,
        triggered_by VARCHAR(80) NULL DEFAULT NULL,
        source_page VARCHAR(40) NULL DEFAULT 'pos',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comm_log_order (order_id),
        INDEX idx_comm_log_customer (customer_id),
        INDEX idx_comm_log_store_date (store_id, created_at),
        INDEX idx_comm_log_channel_status (channel, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ Verified / Created table: tbl_communication_logs');

    const [columns] = await connection.query('SHOW COLUMNS FROM tbl_communication_logs');
    console.log(`Table tbl_communication_logs has ${columns.length} columns.`);

    const [indexes] = await connection.query('SHOW INDEX FROM tbl_communication_logs');
    console.log(`Table tbl_communication_logs has ${indexes.length} index entries.`);

    console.log('🎉 Migration add_communication_logs completed successfully.');
  } catch (err) {
    console.error('❌ Migration error:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();
