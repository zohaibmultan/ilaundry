const { conn } = require('../../middelwer/db');

/**
 * Idempotently ensures tbl_orderstatus includes:
 *   - 9: 'Submitted' (Customer Portal pickup request awaiting store acceptance)
 *   - 10: 'Accepted' (Approved pickup request converted into an active order)
 */
async function migrate() {
  console.log('--- Starting Migration: Ensure Submitted (9) & Accepted (10) statuses in tbl_orderstatus ---');
  const promiseConn = conn.promise();

  const statusesToEnsure = [
    { id: 9, status: 'Submitted' },
    { id: 10, status: 'Accepted' },
  ];

  for (const item of statusesToEnsure) {
    const [existingById] = await promiseConn.query('SELECT id, status FROM tbl_orderstatus WHERE id = ? LIMIT 1', [item.id]);
    if (existingById.length === 0) {
      await promiseConn.query('INSERT INTO tbl_orderstatus (id, status) VALUES (?, ?)', [item.id, item.status]);
      console.log(`✓ Inserted tbl_orderstatus id=${item.id} (${item.status})`);
    } else if (existingById[0].status !== item.status) {
      await promiseConn.query('UPDATE tbl_orderstatus SET status = ? WHERE id = ?', [item.status, item.id]);
      console.log(`✓ Updated tbl_orderstatus id=${item.id} from '${existingById[0].status}' to '${item.status}'`);
    } else {
      console.log(`• tbl_orderstatus id=${item.id} (${item.status}) already exists`);
    }
  }

  console.log('--- Migration Complete ---');
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
