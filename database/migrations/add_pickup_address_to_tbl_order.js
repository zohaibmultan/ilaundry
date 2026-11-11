const { mySqlQury } = require('../../middelwer/db');

async function migrate() {
  console.log('--- Starting Migration: Add pickup_address to tbl_order ---');
  const cols = await mySqlQury('SHOW COLUMNS FROM tbl_order');
  const colNames = cols.map((c) => c.Field);

  if (!colNames.includes('pickup_address')) {
    console.log('Adding pickup_address column to tbl_order...');
    await mySqlQury(
      'ALTER TABLE tbl_order ADD COLUMN pickup_address VARCHAR(255) NULL DEFAULT NULL AFTER pickup_date'
    );
    console.log('✓ Added pickup_address column to tbl_order');
  } else {
    console.log('• pickup_address column already exists in tbl_order');
  }

  console.log('--- Migration Complete ---');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
