const path = require('path');
const { DataFind, DataUpdate } = require(path.join(__dirname, '../middelwer/databaseQurey'));

async function test() {
  try {
    const orders = await DataFind('SELECT id, order_id, store_id, order_status, transferred_from_store_id, note FROM tbl_order LIMIT 1');
    console.log('Sample order before:', orders[0]);

    const targetStoreId = orders[0].store_id == 1 ? 2 : 1;
    const currentStoreId = orders[0].store_id;
    const testNote = '[Test transfer note]';

    await DataUpdate('tbl_order', `store_id=${targetStoreId}, transferred_from_store_id=${currentStoreId}, order_status=7, note='${testNote}'`, `id=${orders[0].id}`);

    const updated = await DataFind(`SELECT id, order_id, store_id, order_status, transferred_from_store_id, note FROM tbl_order WHERE id=${orders[0].id}`);
    console.log('Order after transfer test:', updated[0]);

    // Restore original state
    const originalNote = (orders[0].note || '').replace(/'/g, "\\'");
    await DataUpdate('tbl_order', `store_id=${currentStoreId}, transferred_from_store_id=NULL, order_status=${orders[0].order_status}, note='${originalNote}'`, `id=${orders[0].id}`);
    console.log('Restored order to original state successfully');
  } catch (e) {
    console.error(e);
  }
  process.exit(0);
}

test();
