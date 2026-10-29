require('dotenv').config({ path: 'config.env' });
const mysql = require('mysql2/promise');

async function migrate() {
    console.log('Connecting to database...');
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT
    });

    try {
        console.log('Checking columns in tbl_customer...');
        const [cols] = await conn.query('SHOW COLUMNS FROM tbl_customer');
        const colNames = cols.map(c => c.Field);

        if (!colNames.includes('img')) {
            console.log('Adding img column to tbl_customer...');
            await conn.query("ALTER TABLE tbl_customer ADD COLUMN img VARCHAR(255) NULL DEFAULT '' AFTER password");
            console.log('[SUCCESS] img column added to tbl_customer.');
        } else {
            console.log('[SKIP] img column already exists in tbl_customer.');
        }

        // Also verify tbl_admin has img
        const [adminCols] = await conn.query('SHOW COLUMNS FROM tbl_admin');
        const adminColNames = adminCols.map(c => c.Field);
        if (!adminColNames.includes('img')) {
            console.log('Adding img column to tbl_admin...');
            await conn.query("ALTER TABLE tbl_admin ADD COLUMN img VARCHAR(255) NULL DEFAULT '' AFTER delet_flage");
            console.log('[SUCCESS] img column added to tbl_admin.');
        } else {
            console.log('[CONFIRMED] tbl_admin already has img column.');
        }

    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await conn.end();
        console.log('Database connection closed.');
    }
}

migrate();
