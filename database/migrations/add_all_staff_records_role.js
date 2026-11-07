const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../config.env') });

const dbHost = (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim();
const dbPort = Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306;
const dbUser = (process.env.DB_USER || 'root').replace(/['"]/g, '').trim();
const dbPassword = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '';
const dbName = (process.env.DB_NAME || 'lndry').replace(/['"]/g, '').trim();

async function migrate() {
  console.log(`Connecting to database ${dbName} at ${dbHost}:${dbPort}...`);
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  console.log('Connected! Verifying schema extensions...');

  // 1. Extend tbl_roll
  const [tblRollCols] = await conn.query('SHOW COLUMNS FROM tbl_roll');
  const tblRollColNames = tblRollCols.map(c => c.Field);

  if (!tblRollColNames.includes('all_staff_records')) {
    console.log('Adding all_staff_records column to tbl_roll...');
    await conn.query("ALTER TABLE tbl_roll ADD COLUMN all_staff_records VARCHAR(255) NOT NULL DEFAULT '' AFTER printer_setting");
    console.log('✅ Column all_staff_records added to tbl_roll');
  } else {
    console.log('Column all_staff_records already exists in tbl_roll.');
  }

  // 2. Extend tbl_staff_roll
  const [tblStaffRollCols] = await conn.query('SHOW COLUMNS FROM tbl_staff_roll');
  const tblStaffRollColNames = tblStaffRollCols.map(c => c.Field);

  if (!tblStaffRollColNames.includes('all_staff_records')) {
    console.log('Adding all_staff_records column to tbl_staff_roll...');
    await conn.query("ALTER TABLE tbl_staff_roll ADD COLUMN all_staff_records VARCHAR(255) NOT NULL DEFAULT '' AFTER printer_setting");
    console.log('✅ Column all_staff_records added to tbl_staff_roll');
  } else {
    console.log('Column all_staff_records already exists in tbl_staff_roll.');
  }

  // 3. Update Master and Store predefined roles in tbl_roll and tbl_staff_roll
  await conn.query(`UPDATE tbl_roll SET all_staff_records = 'read' WHERE id IN (1, 2)`);
  await conn.query(`UPDATE tbl_staff_roll SET all_staff_records = 'read' WHERE is_staff = '0' OR main_roll_id = 1`);
  console.log('✅ Updated tbl_roll & tbl_staff_roll default permissions for Master (1) and Store Admins');

  await conn.end();
  console.log('🎉 Migration completed successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
