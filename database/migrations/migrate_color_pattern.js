const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    user: 'root',
    password: '',
    database: 'icleaners'
  });

  try {
    console.log('Inspecting tbl_cart_servicelist columns...');
    const [cols] = await connection.query('SHOW COLUMNS FROM tbl_cart_servicelist');
    const existing = cols.map(c => c.Field);

    if (!existing.includes('primary_color')) {
      console.log('Adding primary_color column...');
      await connection.query('ALTER TABLE tbl_cart_servicelist ADD COLUMN primary_color VARCHAR(50) NULL DEFAULT NULL AFTER service_color');
    } else {
      console.log('primary_color column already exists.');
    }

    if (!existing.includes('secondary_color')) {
      console.log('Adding secondary_color column...');
      await connection.query('ALTER TABLE tbl_cart_servicelist ADD COLUMN secondary_color VARCHAR(50) NULL DEFAULT NULL AFTER primary_color');
    } else {
      console.log('secondary_color column already exists.');
    }

    if (!existing.includes('garment_pattern')) {
      console.log('Adding garment_pattern column...');
      await connection.query('ALTER TABLE tbl_cart_servicelist ADD COLUMN garment_pattern VARCHAR(50) NULL DEFAULT "Solid" AFTER secondary_color');
    } else {
      console.log('garment_pattern column already exists.');
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

migrate();

