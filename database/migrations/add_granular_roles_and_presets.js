const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../config.env') });

const dbHost = (process.env.DB_HOST || 'localhost').replace(/['"]/g, '').trim();
const dbPort = Number(String(process.env.DB_PORT || '3306').replace(/['"]/g, '').trim()) || 3306;
const dbUser = (process.env.DB_USER || 'root').replace(/['"]/g, '').trim();
const dbPassword = process.env.DB_PASSWORD !== undefined ? String(process.env.DB_PASSWORD).replace(/^["']|["']$/g, '') : '';
const dbName = (process.env.DB_NAME || 'lndry').replace(/['"]/g, '').trim();

const NEW_PERMISSION_COLUMNS = [
  'pickup_requests',
  'racks',
  'route_calendar',
  'pos_price_discount_override',
  'order_payment_collect',
  'financial_reports',
];

const ROLE_PRESETS = [
  {
    roll: 'Front-Desk Cashier',
    rollType: 'store',
    orders: 'read,edit',
    expense: '',
    service: '',
    reports: 'read',
    tools: '',
    mail: '',
    master: '',
    sms: '',
    staff: '',
    pos: 'read,write',
    customers: 'read,write,edit',
    master_setting: '',
    branch_n_store: '',
    Pay_Out: '',
    account: '',
    coupon: 'read',
    rollaccess: '',
    notification_setting: '',
    notification_templates: '',
    store_setting: '',
    printer_setting: 'read',
    all_staff_records: '',
    customer_credentials: '',
    pickup_requests: 'read',
    racks: 'read',
    route_calendar: 'read',
    pos_price_discount_override: '',
    order_payment_collect: 'write',
    financial_reports: '',
  },
  {
    roll: 'Route Driver / Dispatcher',
    rollType: 'store',
    orders: 'read,edit',
    expense: '',
    service: '',
    reports: '',
    tools: '',
    mail: '',
    master: '',
    sms: '',
    staff: '',
    pos: '',
    customers: 'read',
    master_setting: '',
    branch_n_store: '',
    Pay_Out: '',
    account: '',
    coupon: '',
    rollaccess: '',
    notification_setting: '',
    notification_templates: '',
    store_setting: '',
    printer_setting: '',
    all_staff_records: 'read',
    customer_credentials: '',
    pickup_requests: 'read,edit',
    racks: 'read',
    route_calendar: 'read,edit',
    pos_price_discount_override: '',
    order_payment_collect: '',
    financial_reports: '',
  },
  {
    roll: 'Plant / Assembly & Rack Operator',
    rollType: 'store',
    orders: 'read,edit',
    expense: '',
    service: 'read',
    reports: '',
    tools: '',
    mail: '',
    master: '',
    sms: '',
    staff: '',
    pos: '',
    customers: '',
    master_setting: '',
    branch_n_store: '',
    Pay_Out: '',
    account: '',
    coupon: '',
    rollaccess: '',
    notification_setting: '',
    notification_templates: '',
    store_setting: '',
    printer_setting: '',
    all_staff_records: 'read',
    customer_credentials: '',
    pickup_requests: '',
    racks: 'read,write,edit,delete',
    route_calendar: '',
    pos_price_discount_override: '',
    order_payment_collect: '',
    financial_reports: '',
  },
  {
    roll: 'Store Supervisor / Assistant Manager',
    rollType: 'store',
    orders: 'read,write,edit,delete',
    expense: 'read,write,edit',
    service: 'read,write,edit',
    reports: 'read',
    tools: 'read',
    mail: '',
    master: '',
    sms: '',
    staff: 'read,write,edit',
    pos: 'read,write,edit',
    customers: 'read,write,edit',
    master_setting: '',
    branch_n_store: '',
    Pay_Out: '',
    account: '',
    coupon: 'read,write,edit',
    rollaccess: '',
    notification_setting: '',
    notification_templates: '',
    store_setting: '',
    printer_setting: 'read,edit',
    all_staff_records: 'read',
    customer_credentials: 'edit',
    pickup_requests: 'read,edit',
    racks: 'read,write,edit,delete',
    route_calendar: 'read,edit',
    pos_price_discount_override: 'edit',
    order_payment_collect: 'write',
    financial_reports: '',
  },
  {
    roll: 'Accountant / Bookkeeper',
    rollType: 'store',
    orders: 'read',
    expense: 'read,write,edit,delete',
    service: '',
    reports: 'read',
    tools: '',
    mail: '',
    master: '',
    sms: '',
    staff: '',
    pos: '',
    customers: 'read',
    master_setting: '',
    branch_n_store: '',
    Pay_Out: 'read,write',
    account: 'read,write,edit',
    coupon: '',
    rollaccess: '',
    notification_setting: '',
    notification_templates: '',
    store_setting: '',
    printer_setting: '',
    all_staff_records: 'read',
    customer_credentials: '',
    pickup_requests: '',
    racks: '',
    route_calendar: '',
    pos_price_discount_override: '',
    order_payment_collect: '',
    financial_reports: 'read',
  },
];

function deriveTokens(str) {
  return new Set(
    String(str || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

function joinTokens(tokens) {
  return tokens.filter(Boolean).join(',');
}

async function ensureColumns(conn, tableName) {
  const [cols] = await conn.query(`SHOW COLUMNS FROM \`${tableName}\``);
  const existing = new Set(cols.map((c) => c.Field.toLowerCase()));
  const addedCols = [];

  for (const col of NEW_PERMISSION_COLUMNS) {
    if (!existing.has(col.toLowerCase())) {
      await conn.query(
        `ALTER TABLE \`${tableName}\` ADD COLUMN \`${col}\` VARCHAR(100) NOT NULL DEFAULT ''`
      );
      addedCols.push(col);
      console.log(`✅ Added column '${col}' to ${tableName}`);
    } else {
      console.log(`Column '${col}' already exists in ${tableName}.`);
    }
  }
  return addedCols;
}

async function migrate() {
  console.log(`Connecting to database ${dbName} at ${dbHost}:${dbPort}...`);
  const conn = await mysql.createConnection({
    host: dbHost,
    port: dbPort,
    user: dbUser,
    password: dbPassword,
    database: dbName,
  });

  try {
    const addedRollCols = await ensureColumns(conn, 'tbl_roll');
    const addedStaffRollCols = await ensureColumns(conn, 'tbl_staff_roll');

    // 1. Seed full granular permissions for Master (1) and Store (2) when newly added
    if (addedRollCols.length > 0) {
      await conn.query(
        `UPDATE tbl_roll
         SET pickup_requests = 'read,edit',
             racks = 'read,write,edit,delete',
             route_calendar = 'read,edit',
             pos_price_discount_override = 'edit',
             order_payment_collect = 'write',
             financial_reports = 'read'
         WHERE id IN (1, 2)`
      );
      console.log('✅ Seeded full granular permissions for Master (1) and Store (2) base roles.');

      // Preserve compatibility for existing custom roles (excluding Customer id=3)
      const [customRolls] = await conn.query(
        `SELECT * FROM tbl_roll WHERE id NOT IN (1, 2, 3) AND delet_flage = 0`
      );
      for (const r of customRolls) {
        const ord = deriveTokens(r.orders);
        const srv = deriveTokens(r.service);
        const pos = deriveTokens(r.pos);
        const rep = deriveTokens(r.reports);

        const pickupReq = joinTokens([ord.has('read') && 'read', ord.has('edit') && 'edit']);
        const racks = joinTokens([
          (ord.has('read') || srv.has('read')) && 'read',
          (ord.has('write') || srv.has('write')) && 'write',
          (ord.has('edit') || srv.has('edit')) && 'edit',
          (ord.has('delete') || srv.has('delete')) && 'delete',
        ]);
        const routeCal = joinTokens([ord.has('read') && 'read', ord.has('edit') && 'edit']);
        const overridePerm = (pos.has('write') || pos.has('edit')) ? 'edit' : '';
        const collectPayPerm = (ord.has('edit') || pos.has('write')) ? 'write' : '';
        const finRepPerm = rep.has('read') ? 'read' : '';

        await conn.query(
          `UPDATE tbl_roll
           SET pickup_requests = ?, racks = ?, route_calendar = ?, pos_price_discount_override = ?, order_payment_collect = ?, financial_reports = ?
           WHERE id = ?`,
          [pickupReq, racks, routeCal, overridePerm, collectPayPerm, finRepPerm, r.id]
        );
      }
    }

    // 2. Migrate existing tbl_staff_roll rows without disrupting existing staff access
    if (addedStaffRollCols.length > 0) {
      await conn.query(
        `UPDATE tbl_staff_roll
         SET pickup_requests = 'read,edit',
             racks = 'read,write,edit,delete',
             route_calendar = 'read,edit',
             pos_price_discount_override = 'edit',
             order_payment_collect = 'write',
             financial_reports = 'read'
         WHERE is_staff = '0' OR main_roll_id = '1'`
      );

      const [staffRows] = await conn.query(
        `SELECT * FROM tbl_staff_roll WHERE is_staff != '0' AND main_roll_id != '1'`
      );
      for (const sr of staffRows) {
        const ord = deriveTokens(sr.orders);
        const srv = deriveTokens(sr.service);
        const pos = deriveTokens(sr.pos);
        const rep = deriveTokens(sr.reports);

        const pickupReq = joinTokens([ord.has('read') && 'read', ord.has('edit') && 'edit']);
        const racks = joinTokens([
          (ord.has('read') || srv.has('read')) && 'read',
          (ord.has('write') || srv.has('write')) && 'write',
          (ord.has('edit') || srv.has('edit')) && 'edit',
          (ord.has('delete') || srv.has('delete')) && 'delete',
        ]);
        const routeCal = joinTokens([ord.has('read') && 'read', ord.has('edit') && 'edit']);
        const overridePerm = (pos.has('write') || pos.has('edit')) ? 'edit' : '';
        const collectPayPerm = (ord.has('edit') || pos.has('write')) ? 'write' : '';
        const finRepPerm = rep.has('read') ? 'read' : '';

        await conn.query(
          `UPDATE tbl_staff_roll
           SET pickup_requests = ?, racks = ?, route_calendar = ?, pos_price_discount_override = ?, order_payment_collect = ?, financial_reports = ?
           WHERE id = ?`,
          [pickupReq, racks, routeCal, overridePerm, collectPayPerm, finRepPerm, sr.id]
        );
      }
      console.log(`✅ Migrated ${staffRows.length} existing staff permission record(s) with backward-compatible defaults.`);
    }

    // 3. Seed the 5 suggested Store Role Presets idempotently
    for (const preset of ROLE_PRESETS) {
      const [existing] = await conn.query(
        `SELECT id FROM tbl_roll WHERE LOWER(roll) = LOWER(?) AND delet_flage = 0 LIMIT 1`,
        [preset.roll]
      );
      if (existing && existing.length > 0) {
        console.log(`Role preset '${preset.roll}' already exists (id=${existing[0].id}). Skipping insert.`);
        continue;
      }

      const cols = Object.keys(preset);
      const vals = cols.map((k) => preset[k]);
      const placeholders = cols.map(() => '?').join(', ');

      const [res] = await conn.query(
        `INSERT INTO tbl_roll (${cols.map((c) => `\`${c}\``).join(', ')}, roll_status, delet_flage)
         VALUES (${placeholders}, 'active', 0)`,
        vals
      );
      console.log(`✅ Seeded role preset '${preset.roll}' (id=${res.insertId}).`);
    }

    console.log('🎉 Migration completed successfully!');
  } finally {
    await conn.end();
  }
}

migrate().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
