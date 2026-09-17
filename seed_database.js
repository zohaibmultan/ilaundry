const bcrypt = require('bcrypt');
const { mySqlQury } = require('./middelwer/db');

async function seed() {
  console.log('🚀 Starting full database wipeout and multi-store population...');

  try {
    // =========================================================================
    // STEP 1: WIPE TRANSACTIONAL AND ENTITY TABLES
    // =========================================================================
    console.log('🧹 Clearing existing database tables...');
    await mySqlQury('SET FOREIGN_KEY_CHECKS = 0');

    const tablesToClear = [
      'tbl_order',
      'tbl_order_payment',
      'tbl_cart',
      'tbl_cart_servicelist',
      'tbl_transections',
      'tbl_customer',
      'tbl_store',
      'tbl_admin',
      'tbl_staff_roll',
      'tbl_services',
      'tbl_services_type',
      'tbl_addons',
      'tbl_coupon',
      'tbl_account',
      'tbl_expense',
      'tbl_exp_cat',
      'tbl_exp_cat_type',
      'tbl_notification',
      'tbl_commision'
    ];

    for (const tbl of tablesToClear) {
      await mySqlQury(`TRUNCATE TABLE ${tbl}`);
    }
    console.log('✅ Tables truncated.');

    // =========================================================================
    // STEP 2: SETUP SYSTEM CONFIGURATION & BASE ROLES
    // =========================================================================
    console.log('⚙️ Ensuring system roles and settings...');

    // Base roles in tbl_roll
    await mySqlQury(`
      INSERT INTO tbl_roll (id, roll, rollType, orders, expense, service, reports, tools, mail, master, sms, staff, pos, customers, master_setting, branch_n_store, Pay_Out, account, coupon, rollaccess, roll_status, delet_flage)
      VALUES 
      (12, 'Master', 'master', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read', 'read', 'read,edit', 'read,edit', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write', 'read,write,edit,delete', 'read,edit', 'read,write,edit', 'read', 'read,write,edit,delete', 'read,write,edit,delete', 'read,edit', 'active', '0'),
      (13, 'Store', 'store', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete', 'read', 'read', 'read,edit', 'read,edit', 'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit', 'read,write,edit,delete', '', '', '', 'read,write,edit,delete', '', 'read,edit', 'active', '0'),
      (14, 'Customer', 'customer', 'read', '', '', '', '', '', '', '', '', 'read', '', '', '', '', '', '', '', 'active', '0'),
      (15, 'Order Delete', 'store', 'read,delete', '', '', 'read', '', '', '', '', '', 'read,write', 'read,write', '', '', '', '', '', '', 'active', '0')
      ON DUPLICATE KEY UPDATE 
        orders = VALUES(orders),
        expense = VALUES(expense),
        service = VALUES(service),
        roll_status = 'active',
        delet_flage = '0'
    `);

    // Ensure tbl_orderstatus
    await mySqlQury(`
      INSERT INTO tbl_orderstatus (id, status) VALUES
      (1, 'Pending'),
      (2, 'Processing'),
      (3, 'Ready To deliver'),
      (4, 'Deliver'),
      (5, 'Returned'),
      (6, 'Cancelled')
      ON DUPLICATE KEY UPDATE status = VALUES(status)
    `);

    // Ensure tbl_master_shop has multi-branch = 1
    const masterShop = await mySqlQury('SELECT id FROM tbl_master_shop WHERE id = 1');
    if (masterShop.length === 0) {
      await mySqlQury(`
        INSERT INTO tbl_master_shop (
          id, type, customer_selection, currency_symbol, currency_placement, thousands_separator,
          customer_autoapprove, store_autoapprove, timezone, printer, storeroll, app_name, footer
        ) VALUES (
          1, '1', '1', '$', 0, '1', 1, 1, 'Asia/Karachi', 1, 12, 'iLaundry Cleaners', 'Copyright 2026 © iLaundry'
        )
      `);
    } else {
      await mySqlQury(`UPDATE tbl_master_shop SET type = '1', currency_symbol = '$', customer_selection = '1' WHERE id = 1`);
    }

    // Password hash for 123456
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('123456', salt);

    // =========================================================================
    // STEP 3: CREATE SUPER ADMIN ACCOUNT
    // =========================================================================
    console.log('👤 Creating Super Admin account (admin / 123456)...');
    const adminStaffRoll = await mySqlQury(`
      INSERT INTO tbl_staff_roll (
        pos, orders, customers, coupon, expense, service, branch_n_store, staff,
        sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out,
        account, main_roll_id, staff_id, is_staff
      ) VALUES (
        'read,write', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete',
        'read,write,edit,delete', 'read,write,edit,delete', 'read,write,edit', 'read,write,edit,delete',
        'read,write,edit,delete', 'read,edit', 'read,edit', 'read', 'read', 'read,edit', 'read,edit', 'read',
        'read,write,edit,delete', '12', '1', '0'
      )
    `);

    await mySqlQury(`
      INSERT INTO tbl_admin (id, name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff)
      VALUES (1, 'Super Admin', '+1-800-555-0100', 'admin@laundry.com', 'admin', '${passwordHash}', '', '${adminStaffRoll.insertId}', 1, '0', '0')
    `);

    await mySqlQury(`UPDATE tbl_staff_roll SET staff_id = '1' WHERE id = ${adminStaffRoll.insertId}`);
    console.log('✅ Super Admin created.');

    // =========================================================================
    // STEP 4: CREATE 4 DISTINCT STORES
    // =========================================================================
    console.log('🏪 Seeding 4 commercial stores...');

    const storeProfiles = [
      {
        name: 'Metro Dry Cleaners & Laundry',
        username: 'metro',
        email: 'metro@laundry.com',
        phone: '+1-212-555-0144',
        address: '742 Broadway Commercial Center',
        city: 'New York',
        state: 'NY',
        zip: '10001',
        country: 'USA',
        tax: 8.5,
        comm: 10,
        staffNames: ['Alex Miller', 'Sarah Jenkins']
      },
      {
        name: 'UrbanDhobi Express',
        username: 'urbandhobi',
        email: 'contact@urbandhobi.com',
        phone: '+1-312-555-0182',
        address: '1204 Michigan Avenue, Loop District',
        city: 'Chicago',
        state: 'IL',
        zip: '60601',
        tax: 9.0,
        comm: 12,
        staffNames: ['David Chen', 'Emily Watson']
      },
      {
        name: 'Sunrise Eco Washers',
        username: 'sunrise',
        email: 'hello@sunrise-wash.com',
        phone: '+1-415-555-0199',
        address: '88 Mission Boulevard, SoMa',
        city: 'San Francisco',
        state: 'CA',
        zip: '94103',
        tax: 8.75,
        comm: 10,
        staffNames: ['Carlos Mendez', 'Jessica Taylor']
      },
      {
        name: 'Royal Care Garment Studio',
        username: 'royalcare',
        email: 'care@royallaundry.com',
        phone: '+1-310-555-0167',
        address: '450 Rodeo Luxury Suites, Beverly Hills',
        city: 'Los Angeles',
        state: 'CA',
        zip: '90210',
        tax: 9.5,
        comm: 15,
        staffNames: ['Michael Ross', 'Olivia Vance']
      }
    ];

    let orderCounter = 100;
    const allStoreData = [];

    for (let sIdx = 0; sIdx < storeProfiles.length; sIdx++) {
      const sp = storeProfiles[sIdx];
      console.log(`\n--- Populating Store ${sIdx + 1}: ${sp.name} ---`);

      // 1. Insert Store
      const storeRes = await mySqlQury(`
        INSERT INTO tbl_store (
          name, logo, mobile_number, username, password, shop_commission, tax_percent,
          country, state, city, district, zipcode, store_email, store_tax_number,
          address, status, delete_flage
        ) VALUES (
          '${sp.name}', 'default.png', '${sp.phone}', '${sp.username}', '${passwordHash}',
          ${sp.comm}, ${sp.tax}, '${sp.country}', '${sp.state}', '${sp.city}', '${sp.city}',
          '${sp.zip}', '${sp.email}', 'TAX-${sp.zip}-${sIdx + 1}', '${sp.address}', '1', '0'
        )
      `);
      const storeId = storeRes.insertId;

      // 2. Insert Store Manager in tbl_admin
      const managerRoll = await mySqlQury(`
        INSERT INTO tbl_staff_roll (
          pos, orders, customers, coupon, expense, service, branch_n_store, staff,
          sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out,
          account, main_roll_id, staff_id, is_staff
        ) VALUES (
          'read,write,edit', 'read,edit,delete', 'read,write,edit,delete', 'read,write,edit,delete',
          'read,write,edit,delete', 'read,write,edit,delete', '', 'read,write,edit,delete',
          'read,write,edit,delete', 'read,edit', '', 'read', 'read', 'read,edit', 'read,edit', '',
          'read,write,edit,delete', '13', '0', '0'
        )
      `);
      const managerAdmin = await mySqlQury(`
        INSERT INTO tbl_admin (
          name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff
        ) VALUES (
          '${sp.name} Manager', '${sp.phone}', '${sp.email}', '${sp.username}', '${passwordHash}',
          '${storeId}', '${managerRoll.insertId}', 1, '0', '0'
        )
      `);
      await mySqlQury(`UPDATE tbl_staff_roll SET staff_id = '${managerAdmin.insertId}' WHERE id = ${managerRoll.insertId}`);
      await mySqlQury(`UPDATE tbl_store SET admin_id = '${managerAdmin.insertId}', roll_ID = '13' WHERE id = ${storeId}`);

      // 3. Insert 2 Staff Members:
      // Staff 1: Regular Cashier/Operator (orders: 'read,edit')
      const staff1Roll = await mySqlQury(`
        INSERT INTO tbl_staff_roll (
          pos, orders, customers, coupon, expense, service, branch_n_store, staff,
          sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out,
          account, main_roll_id, staff_id, is_staff
        ) VALUES (
          'read,write', 'read,edit', 'read,write,edit', 'read', 'read,write', '', '', '',
          '', '', '', 'read', '', '', '', '', '', '13', '0', '1'
        )
      `);
      const staff1Username = `staff_${sp.username}`;
      const staff1Admin = await mySqlQury(`
        INSERT INTO tbl_admin (
          name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff
        ) VALUES (
          '${sp.staffNames[0]}', '+1-555-01${sIdx}1', 'staff1.${sp.username}@laundry.com', '${staff1Username}',
          '${passwordHash}', '${storeId}', '${staff1Roll.insertId}', 1, '0', '1'
        )
      `);
      await mySqlQury(`UPDATE tbl_staff_roll SET staff_id = '${staff1Admin.insertId}' WHERE id = ${staff1Roll.insertId}`);

      // Staff 2: Supervisor with 'Order Delete' role (orders: 'read,delete')
      const staff2Roll = await mySqlQury(`
        INSERT INTO tbl_staff_roll (
          pos, orders, customers, coupon, expense, service, branch_n_store, staff,
          sms, rollaccess, master_setting, reports, tools, mail, master, Pay_Out,
          account, main_roll_id, staff_id, is_staff
        ) VALUES (
          'read,write', 'read,delete', 'read,write,edit', 'read', 'read,write', '', '', '',
          '', '', '', 'read', '', '', '', '', '', '15', '0', '1'
        )
      `);
      const staff2Username = `lead_${sp.username}`;
      const staff2Admin = await mySqlQury(`
        INSERT INTO tbl_admin (
          name, number, email, username, password, store_ID, roll_id, approved, delet_flage, is_staff
        ) VALUES (
          '${sp.staffNames[1]} (Order Delete)', '+1-555-01${sIdx}2', 'lead.${sp.username}@laundry.com', '${staff2Username}',
          '${passwordHash}', '${storeId}', '${staff2Roll.insertId}', 1, '0', '1'
        )
      `);
      await mySqlQury(`UPDATE tbl_staff_roll SET staff_id = '${staff2Admin.insertId}' WHERE id = ${staff2Roll.insertId}`);

      // 4. Accounts for this Store
      const cashAc = await mySqlQury(`
        INSERT INTO tbl_account (ac_name, ac_number, ac_decrip, store_ID, balance, store_name, delet_flage)
        VALUES ('Cash Counter / Drawer', 'CASH-${storeId}', 'Front counter cash register', '${storeId}', 500.00, '${sp.name}', '0')
      `);
      const bankAc = await mySqlQury(`
        INSERT INTO tbl_account (ac_name, ac_number, ac_decrip, store_ID, balance, store_name, delet_flage)
        VALUES ('Main Operating Account', 'BANK-US-${1000 + storeId}', 'Commercial checking account', '${storeId}', 3500.00, '${sp.name}', '0')
      `);

      // 5. Service Types (Categories: Wash & Fold, Dry Cleaning, Steam Press, Premium Bedding)
      const stWash = await mySqlQury(`INSERT INTO tbl_services_type (services_type, status, store_ID) VALUES ('Wash & Fold', '0', '${storeId}')`);
      const stDry = await mySqlQury(`INSERT INTO tbl_services_type (services_type, status, store_ID) VALUES ('Dry Cleaning', '0', '${storeId}')`);
      const stPress = await mySqlQury(`INSERT INTO tbl_services_type (services_type, status, store_ID) VALUES ('Steam Press', '0', '${storeId}')`);
      const stSpecial = await mySqlQury(`INSERT INTO tbl_services_type (services_type, status, store_ID) VALUES ('Premium & Leather', '0', '${storeId}')`);

      const typeIdsStr = `${stWash.insertId},${stDry.insertId},${stPress.insertId},${stSpecial.insertId}`;

      // 6. Services / Garment Items
      const garmentCatalog = [
        { name: "Men's Formal Shirt", prices: '5.00,12.00,3.50,18.00' },
        { name: "Trousers & Chinos", prices: '6.00,14.00,4.00,20.00' },
        { name: "Casual Denim Jeans", prices: '6.50,15.00,4.50,22.00' },
        { name: "Two-Piece Business Suit", prices: '15.00,28.00,10.00,45.00' },
        { name: "Winter Woolen Jacket", prices: '18.00,32.00,12.00,50.00' },
        { name: "Silk Blouse / Dress", prices: '10.00,22.00,8.00,35.00' },
        { name: "Bed Sheet & Pillowcase Set", prices: '8.00,18.00,6.00,25.00' },
        { name: "Heavy Quilt & Comforter", prices: '20.00,38.00,15.00,55.00' }
      ];

      const insertedServices = [];
      for (const gc of garmentCatalog) {
        const sRes = await mySqlQury(`
          INSERT INTO tbl_services (name, image, services_type_id, services_type_price, store_ID, status)
          VALUES ('${gc.name.replace(/'/g, "\\'")}', 'default.png', '${typeIdsStr}', '${gc.prices}', '${storeId}', '0')
        `);
        insertedServices.push({
          id: sRes.insertId,
          name: gc.name,
          types: [
            { id: stWash.insertId, name: 'Wash & Fold', price: parseFloat(gc.prices.split(',')[0]) },
            { id: stDry.insertId, name: 'Dry Cleaning', price: parseFloat(gc.prices.split(',')[1]) },
            { id: stPress.insertId, name: 'Steam Press', price: parseFloat(gc.prices.split(',')[2]) },
            { id: stSpecial.insertId, name: 'Premium & Leather', price: parseFloat(gc.prices.split(',')[3]) }
          ]
        });
      }

      // 7. Addons
      const a1 = await mySqlQury(`INSERT INTO tbl_addons (addon, price, status, store_ID) VALUES ('Stain Removal Treatment', 3.50, '0', '${storeId}')`);
      const a2 = await mySqlQury(`INSERT INTO tbl_addons (addon, price, status, store_ID) VALUES ('Antiseptic Fabric Conditioner', 2.00, '0', '${storeId}')`);
      const a3 = await mySqlQury(`INSERT INTO tbl_addons (addon, price, status, store_ID) VALUES ('Express Same-Day Rush', 5.00, '0', '${storeId}')`);
      const a4 = await mySqlQury(`INSERT INTO tbl_addons (addon, price, status, store_ID) VALUES ('Eco Moth-Proof Storage Bag', 2.50, '0', '${storeId}')`);
      const storeAddons = [
        { id: a1.insertId, name: 'Stain Removal Treatment', price: 3.50 },
        { id: a2.insertId, name: 'Antiseptic Fabric Conditioner', price: 2.00 },
        { id: a3.insertId, name: 'Express Same-Day Rush', price: 5.00 },
        { id: a4.insertId, name: 'Eco Moth-Proof Storage Bag', price: 2.50 }
      ];

      // 8. Coupons
      await mySqlQury(`
        INSERT INTO tbl_coupon (titel, code, min_purchase, discount, start_date, end_date, store_list_id, coupon_type, limit_forsame_user, status)
        VALUES 
        ('Welcome 10% Off', 'WELCOME10-${sp.username.toUpperCase()}', 20.00, 10.00, '2026-01-01', '2026-12-31', '${storeId}', 'percentage', 3, '0'),
        ('Flat $5 Off Orders Over $35', 'SAVE5-${sp.username.toUpperCase()}', 35.00, 5.00, '2026-01-01', '2026-12-31', '${storeId}', 'amount', 5, '0'),
        ('VIP Member 15% Off', 'VIP15-${sp.username.toUpperCase()}', 50.00, 15.00, '2026-01-01', '2026-12-31', '${storeId}', 'percentage', 10, '0')
      `);

      // 9. Expenses
      const expCatType = await mySqlQury(`INSERT INTO tbl_exp_cat_type (type_name, delet_flage, store_ID) VALUES ('Store Operations', '0', '${storeId}')`);
      const expCat1 = await mySqlQury(`INSERT INTO tbl_exp_cat (exp_cat_type_id, cat_name, delet_flage, store_ID) VALUES ('${expCatType.insertId}', 'Laundry Detergents & Chemicals', '0', '${storeId}')`);
      const expCat2 = await mySqlQury(`INSERT INTO tbl_exp_cat (exp_cat_type_id, cat_name, delet_flage, store_ID) VALUES ('${expCatType.insertId}', 'Utility & Electric Bills', '0', '${storeId}')`);
      const expCat3 = await mySqlQury(`INSERT INTO tbl_exp_cat (exp_cat_type_id, cat_name, delet_flage, store_ID) VALUES ('${expCatType.insertId}', 'Packaging Material & Hangers', '0', '${storeId}')`);

      const expenseSample = [
        { towards: 'Eco Detergent bulk container (50L)', amount: 145.00, cat: expCat1.insertId, daysAgo: 24 },
        { towards: 'Commercial Electricity & Steam Boiler Power', amount: 320.00, cat: expCat2.insertId, daysAgo: 18 },
        { towards: 'Hangers & Eco Garment Covers restock', amount: 88.50, cat: expCat3.insertId, daysAgo: 12 },
        { towards: 'Water Filtration Cartridge Replacement', amount: 65.00, cat: expCat1.insertId, daysAgo: 6 },
        { towards: 'Steam Press Maintenance & Descaling', amount: 110.00, cat: expCatType.insertId, daysAgo: 2 }
      ];

      for (const ex of expenseSample) {
        const d = new Date(Date.now() - ex.daysAgo * 86400000);
        const dStr = d.toISOString().slice(0, 19).replace('T', ' ');
        await mySqlQury(`
          INSERT INTO tbl_expense (
            date, amount, towards, category, taxInclud, payment_mode, created_by, delet_flage, store_ID
          ) VALUES (
            '${dStr}', ${ex.amount}, '${ex.towards}', '${ex.cat}', '0', '${cashAc.insertId}', '${managerAdmin.insertId}', '0', '${storeId}'
          )
        `);
      }

      // 10. Customers for this Store
      // Walk In Customer
      const walkInCust = await mySqlQury(`
        INSERT INTO tbl_customer (name, number, email, address, store_ID, main_roll_id, reffstore, approved, delet_flage)
        VALUES ('Walk In Customer', '', '', '', '${storeId}', '14', '${storeId}', 1, '0')
      `);

      const customerNames = [
        { name: 'Robert Downey', phone: '+1-917-555-0211', email: 'robert.d@gmail.com', addr: '120 West 44th St' },
        { name: 'Emma Watson', phone: '+1-917-555-0212', email: 'emma.w@gmail.com', addr: '45 Lexington Ave' },
        { name: 'James Anderson', phone: '+1-917-555-0213', email: 'james.a@yahoo.com', addr: '882 Park Blvd' },
        { name: 'Sophia Martinez', phone: '+1-917-555-0214', email: 'sophia.m@outlook.com', addr: '310 Green St' },
        { name: 'William Turner', phone: '+1-917-555-0215', email: 'william.t@gmail.com', addr: '14 Elmwood Terrace' },
        { name: 'Ava Robinson', phone: '+1-917-555-0216', email: 'ava.r@gmail.com', addr: '72 Franklin Way' },
        { name: 'Benjamin Scott', phone: '+1-917-555-0217', email: 'ben.scott@gmail.com', addr: '55 Ocean Ave' },
        { name: 'Charlotte Evans', phone: '+1-917-555-0218', email: 'charlotte.e@live.com', addr: '19 Maple Grove' },
        { name: 'Lucas Wright', phone: '+1-917-555-0219', email: 'lucas.w@yahoo.com', addr: '404 Industrial Way' },
        { name: 'Mia Henderson', phone: '+1-917-555-0220', email: 'mia.h@gmail.com', addr: '730 Highland Ave' },
        { name: 'Henry Brooks', phone: '+1-917-555-0221', email: 'henry.b@outlook.com', addr: '12 Riverbank Dr' },
        { name: 'Grace Mitchell', phone: '+1-917-555-0222', email: 'grace.m@gmail.com', addr: '91 Sunset Plaza' }
      ];

      const storeCustomers = [{ id: walkInCust.insertId, name: 'Walk In Customer' }];
      for (let cIdx = 0; cIdx < customerNames.length; cIdx++) {
        const cn = customerNames[cIdx];
        const custPhone = `+1-917-55${sIdx}-02${cIdx < 10 ? '0' + cIdx : cIdx}`;
        const custEmail = `${cn.email.split('@')[0]}.${sp.username}@gmail.com`;
        const custUsername = `${cn.email.split('@')[0]}_${sp.username}`;
        const cRes = await mySqlQury(`
          INSERT INTO tbl_customer (
            name, number, email, address, taxnumber, username, password, store_ID, main_roll_id, reffstore, approved, delet_flage
          ) VALUES (
            '${cn.name}', '${custPhone}', '${custEmail}', '${cn.addr}', 'SSN-${custPhone.slice(-4)}',
            '${custUsername}', '${passwordHash}', '${storeId}', '14', '${storeId}', 1, '0'
          )
        `);
        storeCustomers.push({ id: cRes.insertId, name: cn.name });
      }

      // 11. Generate ~22-25 Realistic Orders Across 30 Days
      console.log(`📦 Generating 24 realistic orders for ${sp.name}...`);
      const paymentTypes = ['cash', 'card', 'upi', 'bank_transfer'];

      for (let oIdx = 0; oIdx < 24; oIdx++) {
        orderCounter++;
        const orderIdStr = `#ORD0${orderCounter}`;

        // Days ago between 0 (today) and 28 days ago
        const daysAgo = Math.floor((23 - oIdx) * 1.2);
        const orderDateObj = new Date(Date.now() - daysAgo * 86400000);
        const deliveryDateObj = new Date(orderDateObj.getTime() + (2 + (oIdx % 3)) * 86400000);

        const orderDateStr = orderDateObj.toISOString().slice(0, 10);
        const deliveryDateStr = deliveryDateObj.toISOString().slice(0, 10);

        // Pick 1-3 items
        const numItems = 1 + (oIdx % 3);
        const selectedCartIds = [];
        let subTotal = 0;

        for (let i = 0; i < numItems; i++) {
          const srv = insertedServices[(oIdx + i) % insertedServices.length];
          const stObj = srv.types[i % srv.types.length];
          const qty = 1 + (i % 2);
          const lineTotal = stObj.price * qty;
          subTotal += lineTotal;

          const cartServ = await mySqlQury(`
            INSERT INTO tbl_cart_servicelist (
              service_id, service_type_id, service_type_price, service_quntity, service_color,
              service_name, service_type_name, service_img
            ) VALUES (
              '${srv.id}', '${stObj.id}', ${stObj.price}, ${qty}, '#333333',
              '${srv.name.replace(/'/g, "\\'")}', '${stObj.name}', 'default.png'
            )
          `);
          selectedCartIds.push(cartServ.insertId);
        }

        // Addons?
        let addonPrice = 0;
        let addonIdStr = '0';
        if (oIdx % 2 === 0) {
          const chosenAddon = storeAddons[oIdx % storeAddons.length];
          addonPrice = chosenAddon.price;
          addonIdStr = String(chosenAddon.id);
        }

        // Discount
        let discount = 0;
        if (oIdx % 4 === 1) {
          discount = 5.00;
        }

        const taxRate = sp.tax;
        const taxableAmount = Math.max(0, subTotal + addonPrice - discount);
        const taxAmount = parseFloat(((taxableAmount * taxRate) / 100).toFixed(2));
        const grossTotal = parseFloat((taxableAmount + taxAmount).toFixed(2));

        // Order Status & Payment Status:
        // Recent orders (daysAgo <= 2): Pending (1) or Processing (2)
        // Mid orders (daysAgo between 3 and 7): Ready (3) or Deliver (4)
        // Older orders (daysAgo > 7): Mostly Delivered (4), occasional Returned (5) or Cancelled (6)
        let orderStatus = 4; // Delivered
        if (daysAgo <= 1) {
          orderStatus = (oIdx % 2 === 0) ? 1 : 2; // Pending or Processing
        } else if (daysAgo <= 4) {
          orderStatus = 3; // Ready To Deliver
        } else if (oIdx === 7) {
          orderStatus = 5; // Returned
        } else if (oIdx === 13) {
          orderStatus = 6; // Cancelled
        }

        // Payment status
        let paidAmount = 0;
        let balanceAmount = grossTotal;

        if (orderStatus === 6) {
          // Cancelled: Unpaid
          paidAmount = 0;
          balanceAmount = 0;
        } else if (oIdx % 5 === 0) {
          // Partially paid
          paidAmount = parseFloat((grossTotal * 0.5).toFixed(2));
          balanceAmount = parseFloat((grossTotal - paidAmount).toFixed(2));
        } else if (oIdx % 7 === 0) {
          // Unpaid
          paidAmount = 0;
          balanceAmount = grossTotal;
        } else {
          // Fully paid
          paidAmount = grossTotal;
          balanceAmount = 0;
        }

        const customer = storeCustomers[oIdx % storeCustomers.length];
        const commAmount = parseFloat(((grossTotal * sp.comm) / 100).toFixed(2));
        const refNumber = `REF-${orderDateStr.replace(/-/g, '')}-${1000 + oIdx}`;

        // Insert Order
        const orderRes = await mySqlQury(`
          INSERT INTO tbl_order (
            order_id, order_date, delivery_date, order_status, service_list, customer_id,
            created_by, store_id, addon_data, addon_price, sub_total, tax, coupon_id,
            coupon_discount, extra_discount, gross_total, paid_amount, balance_amount,
            payment_data, tax_amount, note, master_comission, commission_status, reference_number
          ) VALUES (
            '${orderIdStr}', '${orderDateStr}', '${deliveryDateStr}', ${orderStatus}, '${selectedCartIds.join(',')}',
            '${customer.id}', '1,${managerAdmin.insertId}', '${storeId}', '${addonIdStr}', ${addonPrice},
            ${subTotal}, '${taxRate}', '', 0, ${discount}, ${grossTotal}, ${paidAmount}, ${balanceAmount},
            '0', ${taxAmount}, 'Customer requested eco-friendly packaging', ${commAmount}, '1', '${refNumber}'
          )
        `);

        // If paid amount > 0, insert payment & accounting transaction
        if (paidAmount > 0) {
          const payMode = paymentTypes[oIdx % paymentTypes.length];
          const payAcId = (payMode === 'cash') ? cashAc.insertId : bankAc.insertId;

          const pRes = await mySqlQury(`
            INSERT INTO tbl_order_payment (
              payment_amount, payment_date, payment_account, order_id, reference_number
            ) VALUES (
              ${paidAmount}, '${orderDateStr}', '${payAcId}', '${orderRes.insertId}', '${refNumber}'
            )
          `);

          await mySqlQury(`UPDATE tbl_order SET payment_data = '${pRes.insertId}' WHERE id = ${orderRes.insertId}`);

          // Ledger entry for payment
          await mySqlQury(`
            INSERT INTO tbl_transections (
              account_id, store_ID, transec_detail, transec_type, customer_id,
              debit_amount, credit_amount, balance_amount, date
            ) VALUES (
              '${payAcId}', '${storeId}', 'Payment for ${orderIdStr} (${refNumber})', 'INCOME',
              '${customer.id}', 0, ${paidAmount}, ${paidAmount}, '${orderDateStr} 12:00:00'
            )
          `);
        }

        // Notification for recent orders
        if (daysAgo <= 3) {
          await mySqlQury(`
            INSERT INTO tbl_notification (invoice, date, sender, received, notification)
            VALUES ('${orderIdStr}', '${orderDateStr}', '${managerAdmin.insertId}', '1', 'New order ${orderIdStr} registered at ${sp.name}')
          `);
        }
      }

      allStoreData.push({
        storeId,
        name: sp.name,
        managerUsername: sp.username,
        staff1Username,
        staff2Username
      });
      console.log(`✅ ${sp.name} populated successfully!`);
    }

    await mySqlQury('SET FOREIGN_KEY_CHECKS = 1');
    console.log('\n🎉 ALL 4 STORES AND SEED DATA POPULATED SUCCESSFULLY!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Seeder encountered an error:', error);
    process.exit(1);
  }
}

seed();
