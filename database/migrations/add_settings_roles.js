const mysql = require('../../laundry-cms/node_modules/mysql2/promise');
require('../../laundry-cms/node_modules/dotenv').config({ path: 'laundry-cms/config.env' });

async function migrate() {
  console.log('🚀 Running migration: add_settings_roles...');

  const pool = mysql.createPool({
    host: process.env.HOST || '127.0.0.1',
    user: process.env.USER || 'root',
    password: process.env.PASSWORD || '',
    database: process.env.DATABASE_NAME || 'icleaners'
  });

  const newCols = [
    'notification_setting',
    'notification_templates',
    'store_setting',
    'printer_setting'
  ];

  // Helper to add columns idempotently
  async function addColsIfMissing(tableName) {
    const [existingCols] = await pool.query(`SHOW COLUMNS FROM ${tableName}`);
    const existingColNames = existingCols.map(c => c.Field.toLowerCase());

    for (const col of newCols) {
      if (!existingColNames.includes(col.toLowerCase())) {
        console.log(`Adding column '${col}' to table '${tableName}'...`);
        await pool.query(`ALTER TABLE ${tableName} ADD COLUMN \`${col}\` VARCHAR(45) NULL DEFAULT ''`);
      } else {
        console.log(`Column '${col}' already exists in table '${tableName}'.`);
      }
    }
  }

  await addColsIfMissing('tbl_roll');
  await addColsIfMissing('tbl_staff_roll');

  // Seed default permissions for Master (id=1) and Store (id=2)
  console.log('Seeding default permissions for Master and Store roles...');
  await pool.query(`
    UPDATE tbl_roll 
    SET notification_setting = 'read,edit',
        notification_templates = 'read,edit',
        store_setting = 'read,edit',
        printer_setting = 'read,edit'
    WHERE id IN (1, 2)
  `);

  // Update staff roll records for Master (main_roll_id=1) and Store Admin (main_roll_id=2)
  await pool.query(`
    UPDATE tbl_staff_roll 
    SET notification_setting = 'read,edit',
        notification_templates = 'read,edit',
        store_setting = 'read,edit',
        printer_setting = 'read,edit'
    WHERE main_roll_id IN ('1', '2') OR staff_id = '1'
  `);

  console.log('✅ Migration completed successfully!');
  await pool.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
