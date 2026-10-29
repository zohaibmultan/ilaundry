const mysql = require('mysql2/promise');
require('dotenv').config({path: './config.env'});

(async () => {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const [cols] = await conn.execute('DESCRIBE tbl_services');
  const existingCols = cols.map(c => c.Field);
  console.log('Existing columns in tbl_services:', existingCols);

  const toAdd = [
    { name: 'sequence_no', def: 'INT NOT NULL DEFAULT 0' },
    { name: 'services_type_sequence', def: "VARCHAR(500) NULL DEFAULT ''" },
    { name: 'services_type_items', def: "VARCHAR(500) NULL DEFAULT ''" },
    { name: 'services_type_ready_time', def: "VARCHAR(500) NULL DEFAULT ''" }
  ];

  for (const col of toAdd) {
    if (!existingCols.includes(col.name)) {
      console.log('Adding column:', col.name);
      await conn.execute(`ALTER TABLE tbl_services ADD COLUMN ${col.name} ${col.def}`);
    } else {
      console.log('Column already exists:', col.name);
    }
  }

  // Populate smart defaults for existing services
  const [services] = await conn.execute('SELECT id, services_type_id, sequence_no, services_type_sequence, services_type_items, services_type_ready_time FROM tbl_services');
  console.log('Migrating', services.length, 'services with defaults...');

  for (const s of services) {
    const typeIds = (s.services_type_id || '').split(',').map(t => t.trim()).filter(Boolean);
    const count = typeIds.length;
    
    const seqs = Array.from({ length: count }, (_, i) => i + 1).join(',');
    const items = Array.from({ length: count }, () => 1).join(',');
    const readyTimes = Array.from({ length: count }, () => 1440).join(',');
    const sSeq = (s.sequence_no && s.sequence_no > 0) ? s.sequence_no : s.id;

    await conn.execute(
      'UPDATE tbl_services SET sequence_no = ?, services_type_sequence = ?, services_type_items = ?, services_type_ready_time = ? WHERE id = ?',
      [sSeq, seqs, items, readyTimes, s.id]
    );
  }

  console.log('Migration complete!');
  const [check] = await conn.execute('SELECT id, name, sequence_no, services_type_id, services_type_sequence, services_type_items, services_type_ready_time FROM tbl_services LIMIT 5');
  console.table(check);

  await conn.end();
})();
