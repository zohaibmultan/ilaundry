const { DataFind, DataUpdate } = require('../middelwer/databaseQurey');

async function migrateCustomerAddressSplit() {
  console.log('🚀 Checking columns in tbl_customer...');
  const columns = await DataFind('SHOW COLUMNS FROM tbl_customer');
  const existingCols = columns.map(c => c.Field.toLowerCase());

  const colsToAdd = [
    { name: 'city', sql: "ALTER TABLE `tbl_customer` ADD COLUMN `city` VARCHAR(100) NULL DEFAULT '' AFTER `address`" },
    { name: 'state', sql: "ALTER TABLE `tbl_customer` ADD COLUMN `state` VARCHAR(100) NULL DEFAULT '' AFTER `city`" },
    { name: 'zipcode', sql: "ALTER TABLE `tbl_customer` ADD COLUMN `zipcode` VARCHAR(50) NULL DEFAULT '' AFTER `state`" }
  ];

  for (const col of colsToAdd) {
    if (!existingCols.includes(col.name)) {
      console.log(`➕ Adding column ${col.name} to tbl_customer...`);
      await DataFind(col.sql);
      console.log(`✅ Column ${col.name} added successfully.`);
    } else {
      console.log(`ℹ️ Column ${col.name} already exists in tbl_customer.`);
    }
  }

  const updatedCols = await DataFind('SHOW COLUMNS FROM tbl_customer');
  console.log('🎉 tbl_customer columns now:', updatedCols.map(c => c.Field));
  process.exit(0);
}

migrateCustomerAddressSplit().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
