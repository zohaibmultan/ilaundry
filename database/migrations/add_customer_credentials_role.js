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

  console.log('Connected! Verifying customer_credentials role columns...');

  // 1. Extend tbl_roll
  const [tblRollCols] = await conn.query('SHOW COLUMNS FROM tbl_roll');
  const tblRollColNames = tblRollCols.map((c) => c.Field);
  let tblRollAdded = false;

  if (!tblRollColNames.includes('customer_credentials')) {
    console.log('Adding customer_credentials column to tbl_roll...');
    const afterClause = tblRollColNames.includes('all_staff_records') ? ' AFTER all_staff_records' : '';
    await conn.query(
      `ALTER TABLE tbl_roll ADD COLUMN customer_credentials VARCHAR(255) NOT NULL DEFAULT ''${afterClause}`
    );
    tblRollAdded = true;
    console.log('✅ Column customer_credentials added to tbl_roll');
  } else {
    console.log('Column customer_credentials already exists in tbl_roll.');
  }

  // 2. Extend tbl_staff_roll
  const [tblStaffRollCols] = await conn.query('SHOW COLUMNS FROM tbl_staff_roll');
  const tblStaffRollColNames = tblStaffRollCols.map((c) => c.Field);
  let tblStaffRollAdded = false;

  if (!tblStaffRollColNames.includes('customer_credentials')) {
    console.log('Adding customer_credentials column to tbl_staff_roll...');
    const afterClause = tblStaffRollColNames.includes('all_staff_records') ? ' AFTER all_staff_records' : '';
    await conn.query(
      `ALTER TABLE tbl_staff_roll ADD COLUMN customer_credentials VARCHAR(255) NOT NULL DEFAULT ''${afterClause}`
    );
    tblStaffRollAdded = true;
    console.log('✅ Column customer_credentials added to tbl_staff_roll');
  } else {
    console.log('Column customer_credentials already exists in tbl_staff_roll.');
  }

  // 3. Seed default permission for Master (1) and Store (2) base roles, plus Master/Store admins (is_staff = '0')
  if (tblRollAdded) {
    await conn.query(`UPDATE tbl_roll SET customer_credentials = 'edit' WHERE id IN (1, 2)`);
    console.log('✅ Seeded tbl_roll.customer_credentials = "edit" for Master & Store roles');
  }
  if (tblStaffRollAdded) {
    await conn.query(
      `UPDATE tbl_staff_roll SET customer_credentials = 'edit' WHERE is_staff = '0' OR main_roll_id = 1`
    );
    console.log('✅ Seeded tbl_staff_roll.customer_credentials = "edit" for Master & Store Admin accounts (Staff opt-in)');
  }

  await conn.end();
  console.log('🎉 Migration completed successfully!');
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
