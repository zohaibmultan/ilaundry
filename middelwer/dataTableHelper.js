const { mySqlQury } = require('./db');

/**
 * Executes a standardized server-side DataTables query with pagination, search, and sorting.
 * 
 * @param {Object} req Express request
 * @param {Object} config Query configuration
 * @returns {Promise<Object>} { draw, recordsTotal, recordsFiltered, data }
 */
async function paginateDataTable(req, config) {
    try {
        const params = { ...req.query, ...req.body };
        const draw = parseInt(params.draw) || 1;
        const start = Math.max(0, parseInt(params.start) || 0);
        const length = parseInt(params.length) || 10;
        const searchValue = (params.search && params.search.value ? params.search.value : (params['search[value]'] || '')).trim();

        const {
            select = '*',
            from,
            searchColumns = [],
            baseWhere = [],
            filterWhere = [],
            defaultOrder = 'id DESC',
            columnMap = {},
            groupBy = '',
            postProcess = null
        } = config;

        // 1. Compile base conditions
        const baseConditions = Array.isArray(baseWhere) ? [...baseWhere] : [baseWhere].filter(Boolean);
        const filterConditions = Array.isArray(filterWhere) ? [...filterWhere] : [filterWhere].filter(Boolean);
        const combinedBase = [...baseConditions, ...filterConditions];

        // 2. Total count (without search filter)
        let totalCountSql = `SELECT COUNT(*) AS total FROM ${from}`;
        if (baseConditions.length > 0) {
            totalCountSql += ` WHERE ${baseConditions.join(' AND ')}`;
        }
        if (groupBy) {
            totalCountSql = `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${from} ${baseConditions.length > 0 ? 'WHERE ' + baseConditions.join(' AND ') : ''} GROUP BY ${groupBy}) AS t_sub`;
        }

        const totalRes = await mySqlQury(totalCountSql);
        const recordsTotal = totalRes && totalRes.length > 0 ? (totalRes[0].total || 0) : 0;

        // 3. Search conditions
        const allWhere = [...combinedBase];
        if (searchValue && searchColumns.length > 0) {
            // Escape special SQL characters
            const sanitizedSearch = searchValue.replace(/['"\\%_]/g, '\\$&');
            const searchClauses = searchColumns.map(col => `${col} LIKE '%${sanitizedSearch}%'`);
            allWhere.push(`(${searchClauses.join(' OR ')})`);
        }

        const whereSql = allWhere.length > 0 ? `WHERE ${allWhere.join(' AND ')}` : '';

        // 4. Filtered count
        let filteredCountSql = `SELECT COUNT(*) AS total FROM ${from} ${whereSql}`;
        if (groupBy) {
            filteredCountSql = `SELECT COUNT(*) AS total FROM (SELECT 1 FROM ${from} ${whereSql} GROUP BY ${groupBy}) AS f_sub`;
        }
        const filteredRes = await mySqlQury(filteredCountSql);
        const recordsFiltered = filteredRes && filteredRes.length > 0 ? (filteredRes[0].total || 0) : 0;

        // 5. Sorting
        let orderSql = defaultOrder ? `ORDER BY ${defaultOrder}` : '';
        const orderColIndex = params['order[0][column]'] !== undefined ? params['order[0][column]'] : (params.order && params.order[0] ? params.order[0].column : undefined);
        const orderDir = (params['order[0][dir]'] || (params.order && params.order[0] ? params.order[0].dir : 'asc')).toLowerCase() === 'desc' ? 'DESC' : 'ASC';

        if (orderColIndex !== undefined && columnMap[orderColIndex]) {
            orderSql = `ORDER BY ${columnMap[orderColIndex]} ${orderDir}`;
        }

        // 6. Pagination & Data retrieval
        const groupSql = groupBy ? `GROUP BY ${groupBy}` : '';
        const limitSql = length > 0 ? `LIMIT ${start}, ${length}` : '';
        const dataSql = `SELECT ${select} FROM ${from} ${whereSql} ${groupSql} ${orderSql} ${limitSql}`;

        let rows = await mySqlQury(dataSql);
        if (!Array.isArray(rows)) {
            rows = [];
        }

        // 7. Optional post-processing
        if (typeof postProcess === 'function') {
            rows = await postProcess(rows);
        }

        return {
            draw,
            recordsTotal: parseInt(recordsTotal) || 0,
            recordsFiltered: parseInt(recordsFiltered) || 0,
            data: rows
        };

    } catch (err) {
        console.error("paginateDataTable error:", err);
        return {
            draw: parseInt(req.query.draw || req.body.draw) || 1,
            recordsTotal: 0,
            recordsFiltered: 0,
            data: [],
            error: err.message
        };
    }
}

module.exports = { paginateDataTable };
