const mysql = require('mysql2');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../config.env') });

const dbHost = (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim();
const dbPort = Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306;
const dbUser = (process.env.DB_USER || 'root').replace(/['"]/g, '').trim();
const dbPassword = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '';
const dbName = (process.env.DB_NAME || 'lndry').replace(/['"]/g, '').trim();

const connectionLimit = Number(process.env.DB_CONNECTION_LIMIT || 15);

var conn = mysql.createPool({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
    connectionLimit: connectionLimit,
    waitForConnections: true,
    queueLimit: 0,
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

const mySqlQury = (qry, params = []) => {
    return new Promise((resolve, reject) => {
        if (params && Array.isArray(params) && params.length > 0) {
            conn.query(qry, params, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        } else {
            conn.query(qry, (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        }
    });
};

module.exports = { conn, mySqlQury };