const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const dbHost = (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim();
const dbPort = Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306;
const dbUser = (process.env.DB_USER || 'root').replace(/['"]/g, '').trim();
const dbPassword = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '';
const dbName = (process.env.DB_NAME || 'lndry').replace(/['"]/g, '').trim();

var conn = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    connectionLimit: 100,
    charset: 'utf8mb4',
});

// Ping pool on startup to verify connectivity and report host:port
conn.getConnection((err, connection) => {
    if (err) {
        console.error(`❌ [Database] Connection failed to MySQL at ${dbHost}:${dbPort}/${dbName}:`, err.message);
    } else {
        console.log(`✅ [Database] Successfully connected to MySQL at ${dbHost}:${dbPort}/${dbName}`);
        connection.release();
    }
});

const mySqlQury = (qry) => {
    return new Promise((resolve, reject) => {
        conn.query(qry, (err, row) => {
            if (err) return reject(err);
            resolve(row);
        });
    });
};

module.exports = { conn, mySqlQury };