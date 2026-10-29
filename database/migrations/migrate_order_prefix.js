const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../config.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'icleaners',
    port: process.env.DB_PORT || 3306,
  });

  console.log('Connected to MySQL database.');

  try {
    // 1. Check and add order_prefix column to tbl_store if not present
    const [cols] = await connection.query("SHOW COLUMNS FROM tbl_store LIKE 'order_prefix'");
    if (cols.length === 0) {
      console.log("Adding column 'order_prefix' to tbl_store...");
      await connection.query("ALTER TABLE tbl_store ADD COLUMN order_prefix VARCHAR(10) NULL DEFAULT 'A' AFTER name");
      console.log("Column 'order_prefix' added successfully.");
    } else {
      console.log("Column 'order_prefix' already exists in tbl_store.");
    }

    // 2. Set default prefixes for stores
    console.log("Setting store prefixes: Store 19 -> 'A', Store 20 -> 'B', Store 21 -> 'C'...");
    await connection.query("UPDATE tbl_store SET order_prefix = 'A' WHERE id = 19");
    await connection.query("UPDATE tbl_store SET order_prefix = 'B' WHERE id = 20");
    await connection.query("UPDATE tbl_store SET order_prefix = 'C' WHERE id = 21");
    // Any other active store without a prefix gets 'A'
    await connection.query("UPDATE tbl_store SET order_prefix = 'A' WHERE order_prefix IS NULL OR order_prefix = ''");

    // 3. Migrate existing orders per store
    const [stores] = await connection.query("SELECT id, name, order_prefix FROM tbl_store ORDER BY id ASC");
    
    // Store mapping of old order_id -> new order_id for updating notifications & transactions
    const oldToNewMap = {};

    for (const st of stores) {
      const prefix = (st.order_prefix || 'A').trim().toUpperCase();
      const [orders] = await connection.query(
        "SELECT id, order_id FROM tbl_order WHERE store_id = ? ORDER BY id ASC",
        [st.id]
      );

      console.log(`Processing Store ${st.id} (${st.name}) - Prefix: ${prefix}, Orders count: ${orders.length}`);

      let seq = 100001;
      for (const ord of orders) {
        const newOrderId = `${prefix}${String(seq).padStart(6, '0')}`;
        oldToNewMap[ord.order_id] = newOrderId;

        await connection.query(
          "UPDATE tbl_order SET order_id = ? WHERE id = ?",
          [newOrderId, ord.id]
        );
        console.log(`  Updated order row id ${ord.id}: ${ord.order_id} -> ${newOrderId}`);
        seq++;
      }
    }

    // 4. Update tbl_notification
    console.log("Updating tbl_notification with new order IDs...");
    for (const [oldId, newId] of Object.entries(oldToNewMap)) {
      await connection.query(
        "UPDATE tbl_notification SET invoice = ? WHERE invoice = ?",
        [newId, oldId]
      );
      await connection.query(
        "UPDATE tbl_notification SET notification = REPLACE(notification, ?, ?) WHERE notification LIKE ?",
        [oldId, newId, `%${oldId}%`]
      );
    }

    // 5. Update tbl_transections
    console.log("Updating tbl_transections with new order IDs...");
    for (const [oldId, newId] of Object.entries(oldToNewMap)) {
      await connection.query(
        "UPDATE tbl_transections SET transec_detail = REPLACE(transec_detail, ?, ?) WHERE transec_detail LIKE ?",
        [oldId, newId, `%${oldId}%`]
      );
    }

    // 6. Update active carts with appropriate next order_id
    console.log("Updating active carts in tbl_cart...");
    const [carts] = await connection.query("SELECT id, store_id, order_id, created_by FROM tbl_cart");
    for (const cart of carts) {
      const storeId = cart.store_id || 19;
      const [storeRows] = await connection.query("SELECT order_prefix FROM tbl_store WHERE id = ?", [storeId]);
      const prefix = (storeRows.length > 0 && storeRows[0].order_prefix) ? storeRows[0].order_prefix.trim().toUpperCase() : 'A';
      
      const [latest] = await connection.query(
        `SELECT order_id FROM tbl_order 
         WHERE store_id = ? AND order_id LIKE '${prefix}%' 
         ORDER BY CAST(SUBSTRING(order_id, ${prefix.length + 1}) AS UNSIGNED) DESC 
         LIMIT 1`,
        [storeId]
      );

      let nextSeq = 100001;
      if (latest.length > 0) {
        const numPart = parseInt(latest[0].order_id.substring(prefix.length), 10);
        if (!isNaN(numPart)) nextSeq = numPart + 1;
      }
      const nextCartOrderId = `${prefix}${String(nextSeq).padStart(6, '0')}`;
      await connection.query("UPDATE tbl_cart SET order_id = ? WHERE id = ?", [nextCartOrderId, cart.id]);
      console.log(`  Cart id ${cart.id} (Store ${storeId}) updated order_id: ${cart.order_id} -> ${nextCartOrderId}`);
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    await connection.end();
    process.exit(0);
  }
}

run();
