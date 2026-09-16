const { mySqlQury } = require('./db');

async function DataFind(qry) {
    try {
        return await mySqlQury(qry);
    } catch (err) {
        console.error("DataFind error:", err);
        return [];
    }
}

async function FullDataInsert(qry) {
    try {
        return await mySqlQury(qry);
    } catch (err) {
        console.error("FullDataInsert error:", err);
        return -1;
    }
}

async function DataInsert(table, columns, values, hostname, protocol) {
    try {
        const qry = `INSERT INTO ${table} (${columns}) VALUES (${values})`;
        return await mySqlQury(qry);
    } catch (err) {
        console.error("DataInsert error:", err);
        return -1;
    }
}

async function DataUpdate(table, setClause, whereClause, hostname, protocol) {
    try {
        const qry = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
        return await mySqlQury(qry);
    } catch (err) {
        console.error("DataUpdate error:", err);
        return -1;
    }
}

async function DataDelete(table, whereClause, hostname, protocol) {
    try {
        const qry = `DELETE FROM ${table} WHERE ${whereClause}`;
        return await mySqlQury(qry);
    } catch (err) {
        console.error("DataDelete error:", err);
        return -1;
    }
}

module.exports = {
    DataFind,
    DataInsert,
    DataUpdate,
    DataDelete,
    FullDataInsert
};