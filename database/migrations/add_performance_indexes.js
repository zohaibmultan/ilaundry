const { DataFind } = require('../../middelwer/databaseQurey');
const { conn } = require('../../middelwer/db');

/**
 * Migration: Add performance indexes to core tables.
 * Idempotently checks if each index already exists before creating it.
 */
async function migrate() {
  const promiseConn = conn.promise();

  const indexDefinitions = [
    // tbl_order indexes
    {
      table: 'tbl_order',
      index: 'idx_order_store_status_id',
      columns: '(store_id, order_status, id)',
      desc: 'Optimizes store-level order filtering, status queries, and ID sorting'
    },
    {
      table: 'tbl_order',
      index: 'idx_order_order_id',
      columns: '(order_id)',
      desc: 'Optimizes barcode lookups, POS upfront invoice search, and void lookup'
    },
    {
      table: 'tbl_order',
      index: 'idx_order_customer_id',
      columns: '(customer_id)',
      desc: 'Optimizes customer order history and total count lookups'
    },
    {
      table: 'tbl_order',
      index: 'idx_order_created_by',
      columns: '(created_by)',
      desc: 'Optimizes staff-specific dashboard queries and staff order counts'
    },
    {
      table: 'tbl_order',
      index: 'idx_order_order_date',
      columns: '(order_date)',
      desc: 'Optimizes date range reports and chronological sorting'
    },

    // tbl_cart indexes
    {
      table: 'tbl_cart',
      index: 'idx_cart_created_by',
      columns: '(created_by)',
      desc: 'Optimizes active user cart lookup on every POS interaction'
    },
    {
      table: 'tbl_cart',
      index: 'idx_cart_store_id',
      columns: '(store_id)',
      desc: 'Optimizes store-level cart cleanups and checks'
    },
    {
      table: 'tbl_cart',
      index: 'idx_cart_customer_id',
      columns: '(customer_id)',
      desc: 'Optimizes customer cart lookup and validation'
    },

    // tbl_customer indexes
    {
      table: 'tbl_customer',
      index: 'idx_customer_store_approved_delet',
      columns: '(store_ID, approved, delet_flage)',
      desc: 'Optimizes customer list filtering by store and active status'
    },
    {
      table: 'tbl_customer',
      index: 'idx_customer_number',
      columns: '(number)',
      desc: 'Optimizes POS live customer phone number lookup'
    },
    {
      table: 'tbl_customer',
      index: 'idx_customer_name',
      columns: '(first_name, last_name)',
      desc: 'Optimizes customer search by first/last name'
    },

    // tbl_notification indexes
    {
      table: 'tbl_notification',
      index: 'idx_notification_received_id',
      columns: '(received, id)',
      desc: 'Optimizes unread notification polling and count queries'
    },

    // tbl_services & tbl_services_type
    {
      table: 'tbl_services',
      index: 'idx_services_store_status_seq',
      columns: '(store_ID, status, sequence_no)',
      desc: 'Optimizes POS service catalog lookup and sequence sorting'
    },
    {
      table: 'tbl_services_type',
      index: 'idx_services_type_store_status_seq',
      columns: '(store_ID, status, sequence_no)',
      desc: 'Optimizes POS category lookup and sequence sorting'
    }
  ];

  try {
    console.log('--- Starting Database Performance Indexes Migration ---');

    for (const def of indexDefinitions) {
      const existingIndexes = await DataFind(`SHOW INDEX FROM ${def.table}`);
      const indexNames = existingIndexes.map(idx => idx.Key_name);

      if (indexNames.includes(def.index)) {
        console.log(`[SKIP] ${def.table}.${def.index} already exists.`);
      } else {
        console.log(`[ADDING] ${def.table}.${def.index} ${def.columns} (${def.desc})...`);
        await promiseConn.query(`ALTER TABLE ${def.table} ADD INDEX ${def.index} ${def.columns}`);
        console.log(`[SUCCESS] ${def.table}.${def.index} created.`);
      }
    }

    console.log('--- Database Performance Indexes Migration Completed Successfully ---');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
