const { mySqlQury } = require('../../middelwer/db');

async function migrate() {
  console.log('--- Starting Migration: Add Pick-up & Delivery Status to tbl_order ---');
  const cols = await mySqlQury('SHOW COLUMNS FROM tbl_order');
  const colNames = cols.map(c => c.Field);

  if (!colNames.includes('is_picked_up')) {
    console.log('Adding is_picked_up, picked_up_at, picked_up_by to tbl_order...');
    await mySqlQury(`ALTER TABLE tbl_order 
      ADD COLUMN is_picked_up VARCHAR(5) NOT NULL DEFAULT '0',
      ADD COLUMN picked_up_at DATETIME NULL,
      ADD COLUMN picked_up_by INT NULL`);
    console.log('✓ Added is_picked_up columns');
  } else {
    console.log('• is_picked_up already exists');
  }

  if (!colNames.includes('is_delivered')) {
    console.log('Adding is_delivered, delivered_at, delivered_by to tbl_order...');
    await mySqlQury(`ALTER TABLE tbl_order 
      ADD COLUMN is_delivered VARCHAR(5) NOT NULL DEFAULT '0',
      ADD COLUMN delivered_at DATETIME NULL,
      ADD COLUMN delivered_by INT NULL`);
    console.log('✓ Added is_delivered columns');
  } else {
    console.log('• is_delivered already exists');
  }

  const updatedCols = await mySqlQury('SHOW COLUMNS FROM tbl_order');
  const verified = updatedCols
    .filter(c => ['is_picked_up', 'picked_up_at', 'picked_up_by', 'is_delivered', 'delivered_at', 'delivered_by'].includes(c.Field))
    .map(c => `${c.Field} (${c.Type}, Default: ${c.Default})`);

  console.log('Verified columns in tbl_order:');
  verified.forEach(v => console.log('  -', v));
  console.log('--- Migration Complete ---');
}

migrate()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
