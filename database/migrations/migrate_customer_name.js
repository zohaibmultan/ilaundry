const { DataFind, DataUpdate } = require('../../middelwer/databaseQurey');

async function migrate() {
  try {
    const existingFirst = await DataFind("SHOW COLUMNS FROM tbl_customer LIKE 'first_name'");
    if (existingFirst.length === 0) {
      console.log("Adding first_name and last_name columns to tbl_customer...");
      await DataFind(`
        ALTER TABLE tbl_customer 
        ADD COLUMN first_name VARCHAR(150) NOT NULL DEFAULT '' AFTER name,
        ADD COLUMN last_name VARCHAR(150) NOT NULL DEFAULT '' AFTER first_name
      `);
      console.log("✅ Columns first_name and last_name added successfully!");
    } else {
      console.log("Columns first_name and last_name already exist in tbl_customer.");
    }

    // Migrate existing customers
    const customers = await DataFind("SELECT id, name, first_name, last_name FROM tbl_customer");
    console.log(`Processing ${customers.length} customer records for name splitting...`);

    let updatedCount = 0;
    for (const cust of customers) {
      // If already populated, skip
      if (cust.first_name && cust.first_name.trim() !== '' && cust.last_name && cust.last_name.trim() !== '') {
        continue;
      }

      const rawName = (cust.name || '').trim();
      if (!rawName) continue;

      let fName = '';
      let lName = '';

      if (rawName.toLowerCase().includes('walk in customer')) {
        fName = 'Walk in customer';
        lName = '';
      } else if (rawName.includes(',')) {
        const parts = rawName.split(',');
        lName = parts[0].trim();
        fName = parts.slice(1).join(',').trim();
      } else {
        const parts = rawName.split(/\s+/);
        if (parts.length > 1) {
          fName = parts[0].trim();
          lName = parts.slice(1).join(' ').trim();
        } else {
          fName = rawName;
          lName = '';
        }
      }

      let formattedName = rawName;
      if (lName && fName) {
        formattedName = `${lName}, ${fName}`;
      } else if (lName) {
        formattedName = lName;
      } else if (fName) {
        formattedName = fName;
      }

      const safeFName = fName.replace(/'/g, "\\'");
      const safeLName = lName.replace(/'/g, "\\'");
      const safeFormattedName = formattedName.replace(/'/g, "\\'");

      await DataUpdate(
        'tbl_customer',
        `first_name='${safeFName}', last_name='${safeLName}', name='${safeFormattedName}'`,
        `id=${cust.id}`,
        'localhost',
        'http'
      );
      updatedCount++;
    }

    console.log(`✅ Successfully migrated and split names for ${updatedCount} customers!`);
  } catch (err) {
    console.error("Migration error:", err);
    process.exit(1);
  }
}

migrate().then(() => process.exit(0));
