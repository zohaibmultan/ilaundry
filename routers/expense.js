const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey");
const { paginateDataTable } = require("../middelwer/dataTableHelper");

// Expence Category Type
router.get("/categorytype", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
    );
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    if (
      rolldetail[0].rollType.includes("master") &&
      rolldetail[0].expense.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var qury =
          "SELECT tbl_exp_cat_type.*,tbl_store.name as store FROM tbl_exp_cat_type join tbl_store on tbl_exp_cat_type.store_ID=tbl_store.id WHERE tbl_exp_cat_type.delet_flage=0";
        var ismulty = true;
      } else {
        var ismulty = false;
      }

      res.render("expensetype", {
        type: [],
        ismulty,
        storeList,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType.includes("store") &&
      rolldetail[0].expense.includes("read")
    ) {
      res.render("expensetype", {
        type: [],
        ismulty: false,
        storeList: [],
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/categorytype/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("read")) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const isMaster = rolldetail[0].rollType.includes("master");
    const canEdit = rolldetail[0].expense.includes("edit");
    const canDelete = rolldetail[0].expense.includes("delete");

    const scopeConditions = [`tbl_exp_cat_type.delet_flage = 0`];
    if (!isMaster) {
      scopeConditions.push(`tbl_exp_cat_type.store_ID = '${store}'`);
    }

    const filterConditions = [];
    const storeParam = req.query.store_filter || req.query.store_id;
    if (storeParam && isMaster && !["all", "ALL", "", "0"].includes(String(storeParam).trim())) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_exp_cat_type.store_ID = '${cleanStore}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_exp_cat_type.*, COALESCE(tbl_store.name, '') as store`,
      from: `tbl_exp_cat_type LEFT JOIN tbl_store ON tbl_exp_cat_type.store_ID = tbl_store.id`,
      searchColumns: [
        'tbl_exp_cat_type.type_name',
        'tbl_store.name'
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: 'tbl_exp_cat_type.id DESC',
      columnMap: {
        0: 'tbl_exp_cat_type.id',
        1: 'tbl_exp_cat_type.type_name',
        2: 'tbl_store.name'
      },
      postProcess: async (rows) => {
        return rows.map((t) => ({
          id: t.id,
          type_name: t.type_name || '',
          store: t.store || '',
          store_id: t.store_ID || '',
          canEdit,
          canDelete
        }));
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Expense category type list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addcategorytype", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    if (rolldetail[0].expense.includes("write")) {
      const name = req.body.name;
      var storeid = req.body.storeid;
      storeid ? storeid : (storeid = store);

      // var qury =
      //   "INSERT INTO tbl_exp_cat_type (type_name,store_ID) VALUE ('" +
      //   name +
      //   "'," +
      //   storeid +
      //   ")";
      // const data = await DataFind(qury);

const data1 = await DataInsert(
  `tbl_exp_cat_type`,
  `type_name,store_ID`,
  `'${name}',${storeid}`,
  req.hostname,
  req.protocol
);

if (data1 == -1) {
  req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
}


      req.flash("success", "Expense Category Type Added");
      res.redirect("/expense/categorytype");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updatecategorytype/:id", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    if (rolldetail[0].expense.includes("edit")) {
      const dataid = String(req.params.id).replace(/['"]/g, '').trim();
      const name = req.body.name ? req.body.name.replace(/'/g, "\\'") : '';
      const isMaster = rolldetail[0].rollType.includes("master");

      let updateSet = `type_name='${name}'`;
      if (isMaster && req.body.storeid) {
        const storeid = String(req.body.storeid).replace(/['"]/g, '').trim();
        updateSet += `, store_ID='${storeid}'`;
      }

      let whereClause = `id=${dataid}`;
      if (!isMaster) {
        whereClause += ` AND store_ID='${store}'`;
      }

      const data = await DataUpdate(
        `tbl_exp_cat_type`,
        updateSet,
        whereClause,
        req.hostname,
        req.protocol
      );

      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Expense Category Type Update success");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/deletcategorytype/:id", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    if (rolldetail[0].expense.includes("delete")) {
      const dataid = String(req.params.id).replace(/['"]/g, '').trim();
      const isMaster = rolldetail[0].rollType.includes("master");
      let whereClause = `id=${dataid}`;
      if (!isMaster) {
        whereClause += ` AND store_ID='${store}'`;
      }

      const data = await DataUpdate(
        `tbl_exp_cat_type`,
        `delet_flage=1`,
        whereClause,
        req.hostname,
        req.protocol
      );

      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Expense Category Type Delet success");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/cattypelist/:id", async (req, res) => {
  try {
    const rawId = req.params.id;
    const cleanId = String(rawId || '').replace(/['"]/g, '').trim();

    let query = "SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0";
    if (cleanId && cleanId !== '0' && cleanId !== 'all' && cleanId !== 'undefined' && cleanId !== 'null') {
      const escapedId = cleanId.replace(/'/g, "\\'");
      query += ` AND (store_ID = '${escapedId}' OR store_ID IS NULL OR store_ID = '' OR store_ID = '0')`;
    }

    const data = await DataFind(query);
    res.status(200).json({ data: data });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: [] });
  }
});

// Expense Category
router.get("/categorylist", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("read")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    let ismulty = false;
    let storeList = [];
    let types = [];

    if (isMaster) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy && multiy.length > 0 && multiy[0].type == 1) {
        ismulty = true;
        storeList = await DataFind(
          "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
        );
      }
      types = await DataFind("SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0");
    } else {
      ismulty = false;
      types = await DataFind(
        `SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0 AND (store_ID = '${assignedStore}' OR store_ID IS NULL OR store_ID = '' OR store_ID = '0')`
      );
    }

    res.render("expenceCategory", {
      type: types,
      list: [],
      ismulty,
      storeList,
      assigned_store_id: assignedStore,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/categorylist/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("read")) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');
    const canEdit = rolldetail[0].expense.includes("edit");
    const canDelete = rolldetail[0].expense.includes("delete");

    const scopeConditions = [`tbl_exp_cat.delet_flage = 0`];
    if (!isMaster) {
      scopeConditions.push(`tbl_exp_cat.store_ID = '${assignedStore}'`);
    }

    const filterConditions = [];
    const storeParam = req.query.store_filter || req.query.store_id;
    if (storeParam && isMaster && !["all", "ALL", "", "0"].includes(String(storeParam).trim())) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_exp_cat.store_ID = '${cleanStore}'`);
    }

    const typeParam = req.query.category_type_id || req.query.type_id;
    if (typeParam && !["all", "ALL", ""].includes(String(typeParam).trim())) {
      const cleanType = String(typeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_exp_cat.exp_cat_type_id = '${cleanType}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_exp_cat.id, tbl_exp_cat.store_ID, tbl_exp_cat.exp_cat_type_id, tbl_exp_cat.cat_name, tbl_exp_cat.delet_flage, COALESCE(tbl_exp_cat_type.type_name, '') as type_name, COALESCE(tbl_store.name, '') as store`,
      from: `tbl_exp_cat 
             LEFT JOIN tbl_exp_cat_type ON tbl_exp_cat.exp_cat_type_id = tbl_exp_cat_type.id 
             LEFT JOIN tbl_store ON tbl_exp_cat.store_ID = tbl_store.id`,
      searchColumns: [
        'tbl_exp_cat.cat_name',
        'tbl_exp_cat_type.type_name',
        'tbl_store.name'
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: 'tbl_exp_cat.id DESC',
      columnMap: {
        0: 'tbl_exp_cat.id',
        1: 'tbl_exp_cat.cat_name',
        2: 'tbl_exp_cat_type.type_name',
        3: 'tbl_store.name',
        4: 'tbl_exp_cat.delet_flage'
      },
      postProcess: async (rows) => {
        return rows.map((c) => ({
          id: c.id,
          cat_name: c.cat_name || '',
          exp_cat_type_id: c.exp_cat_type_id,
          type_name: c.type_name || '',
          store_ID: c.store_ID,
          store: c.store || '',
          delet_flage: parseInt(c.delet_flage) || 0,
          canEdit,
          canDelete
        }));
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Expense category list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addexpcate", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("write")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    var { name, type_id, storeid } = req.body;
    name = (name || '').trim();

    if (!name || !type_id) {
      req.flash("error", "Category name and type are required");
      return res.redirect("/expense/categorylist");
    }

    // A user can create expense category for the assigned store only
    let finalStoreId;
    if (!isMaster) {
      if (!assignedStore) {
        req.flash("error", "No store assigned to your account");
        return res.redirect("/expense/categorylist");
      }
      finalStoreId = assignedStore;
    } else {
      finalStoreId = storeid || assignedStore || '0';
    }

    const cleanName = name.replace(/'/g, "\\'");
    const cleanTypeId = String(type_id).replace(/'/g, "\\'");
    const cleanStoreId = String(finalStoreId).replace(/'/g, "\\'");

    const data2 = await DataInsert(
      `tbl_exp_cat`,
      `exp_cat_type_id,cat_name,store_ID`,
      `'${cleanTypeId}','${cleanName}', '${cleanStoreId}'`,
      req.hostname,
      req.protocol
    );

    if (data2 == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/categorylist");
    }

    req.flash("success", "Expense Category Added");
    res.redirect("/expense/categorylist");
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    res.redirect("/expense/categorylist");
  }
});

router.post("/updateexpcat/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("edit")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    const cleanId = String(req.params.id || '').replace(/['"]/g, '').trim();
    if (!cleanId || isNaN(cleanId)) {
      req.flash("error", "Invalid category ID");
      return res.redirect("/expense/categorylist");
    }

    // Verify existing category
    const existing = await DataFind(`SELECT * FROM tbl_exp_cat WHERE id = ${cleanId} AND delet_flage = 0`);
    if (!existing || existing.length === 0) {
      req.flash("error", "Expense category not found");
      return res.redirect("/expense/categorylist");
    }

    // Store scoping check
    if (!isMaster && String(existing[0].store_ID) !== String(assignedStore)) {
      req.flash("error", "You can only update expense categories for your assigned store");
      return res.redirect("/expense/categorylist");
    }

    var cattypid = req.body.type_id;
    var name = (req.body.name || '').trim();

    if (!name || !cattypid) {
      req.flash("error", "Category name and type are required");
      return res.redirect("/expense/categorylist");
    }

    const cleanName = name.replace(/'/g, "\\'");
    const cleanTypeId = String(cattypid).replace(/'/g, "\\'");

    // Update tbl_exp_cat (FIXING the bug where tbl_exp_cat_type was targeted)
    const data = await DataUpdate(
      `tbl_exp_cat`,
      `exp_cat_type_id='${cleanTypeId}', cat_name='${cleanName}'`,
      `id=${cleanId}`,
      req.hostname,
      req.protocol
    );

    if (data == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/categorylist");
    }

    req.flash("success", "Expense Category Updated");
    res.redirect("/expense/categorylist");
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    res.redirect("/expense/categorylist");
  }
});

router.get("/deletexpcat/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("delete")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/categorylist");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    const cleanId = String(req.params.id || '').replace(/['"]/g, '').trim();
    if (!cleanId || isNaN(cleanId)) {
      req.flash("error", "Invalid category ID");
      return res.redirect("/expense/categorylist");
    }

    // Verify existing category
    const existing = await DataFind(`SELECT * FROM tbl_exp_cat WHERE id = ${cleanId}`);
    if (!existing || existing.length === 0) {
      req.flash("error", "Expense category not found");
      return res.redirect("/expense/categorylist");
    }

    // Store scoping check
    if (!isMaster && String(existing[0].store_ID) !== String(assignedStore)) {
      req.flash("error", "You can only delete expense categories for your assigned store");
      return res.redirect("/expense/categorylist");
    }

    // Update tbl_exp_cat (FIXING the bug where tbl_exp_cat_type was targeted)
    const data = await DataUpdate(
      `tbl_exp_cat`,
      `delet_flage= 1`,
      `id=${cleanId}`,
      req.hostname,
      req.protocol
    );

    if (data == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/categorylist");
    }

    req.flash("success", "Expense Category Deleted");
    res.redirect("/expense/categorylist");
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    res.redirect("/expense/categorylist");
  }
});

// <<<<<<<<<<<<<<< expense category list and account by store id >>>>>>>>>>>>>>>>>
router.get("/expcatlist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ error: "Unauthorized", data: [], acountlist: [] });
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || (!rolldetail[0].expense.includes("write") && !rolldetail[0].expense.includes("edit") && !rolldetail[0].expense.includes("read"))) {
      return res.status(403).json({ error: "Unauthorized", data: [], acountlist: [] });
    }

    const rawId = req.params.id;
    const cleanId = String(rawId || '').replace(/['"]/g, '').trim();

    if (!cleanId || cleanId === '0' || cleanId === 'undefined' || cleanId === 'null') {
      return res.status(200).json({ data: [], acountlist: [] });
    }

    const includeCatId = String(req.query.include_cat_id || '').replace(/['"]/g, '').trim();
    const includeAccountId = String(req.query.include_account_id || '').replace(/['"]/g, '').trim();

    let catQuery = `SELECT id, cat_name FROM tbl_exp_cat WHERE store_ID = '${cleanId}'`;
    if (includeCatId && !isNaN(includeCatId)) {
      catQuery += ` AND (delet_flage = 0 OR id = ${includeCatId})`;
    } else {
      catQuery += ` AND delet_flage = 0`;
    }

    let accQuery = `SELECT id, ac_name FROM tbl_account WHERE store_ID = '${cleanId}'`;
    if (includeAccountId && !isNaN(includeAccountId)) {
      accQuery += ` AND (delet_flage != '1' OR id = ${includeAccountId})`;
    } else {
      accQuery += ` AND delet_flage != '1'`;
    }

    const data = await DataFind(catQuery);
    const acountlist = await DataFind(accQuery);

    res.status(200).json({ data: data, acountlist: acountlist });
  } catch (error) {
    console.log(error);
    res.status(500).json({ data: [], acountlist: [] });
  }
});

//>>>>>>>>>>>>>Expense List <<<<<<<<<<<<<<<
router.get("/list", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("read")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    let ismulty = false;
    let storeList = [];
    let expencategory = [];
    let acountlist = [];

    if (isMaster) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy && multiy.length > 0 && multiy[0].type == 1) {
        ismulty = true;
        storeList = await DataFind(
          "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
        );
        // For master multi-store, dropdowns start empty until a store is chosen in add modal,
        // but for toolbar filters we supply all active categories and accounts
        expencategory = await DataFind("SELECT id, cat_name FROM tbl_exp_cat WHERE delet_flage != 1");
        acountlist = await DataFind("SELECT id, ac_name FROM tbl_account WHERE delet_flage != '1'");
      } else {
        ismulty = false;
        expencategory = await DataFind(`SELECT id, cat_name FROM tbl_exp_cat WHERE delet_flage = 0 AND store_ID = '${assignedStore}'`);
        acountlist = await DataFind(`SELECT id, ac_name FROM tbl_account WHERE delet_flage != '1' AND store_ID = '${assignedStore}'`);
      }
    } else {
      ismulty = false;
      expencategory = await DataFind(`SELECT id, cat_name FROM tbl_exp_cat WHERE delet_flage = 0 AND store_ID = '${assignedStore}'`);
      acountlist = await DataFind(`SELECT id, ac_name FROM tbl_account WHERE delet_flage != '1' AND store_ID = '${assignedStore}'`);
    }

    res.render("expensList", {
      categ: expencategory,
      expenlist: [],
      ismulty,
      storeList,
      acountlist,
      assigned_store_id: assignedStore,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/list/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("read")) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');
    const canEdit = rolldetail[0].expense.includes("edit");
    const canDelete = rolldetail[0].expense.includes("delete");

    const scopeConditions = [`tbl_expense.delet_flage = 0`];
    if (!isMaster) {
      scopeConditions.push(`tbl_expense.store_ID = '${assignedStore}'`);
    }

    const filterConditions = [];
    const storeParam = req.query.store_filter || req.query.store_id;
    if (storeParam && isMaster && !["all", "ALL", "", "0"].includes(String(storeParam).trim())) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_expense.store_ID = '${cleanStore}'`);
    }

    const catParam = req.query.category_filter || req.query.category;
    if (catParam && !["all", "ALL", ""].includes(String(catParam).trim())) {
      const cleanCat = String(catParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_expense.category = '${cleanCat}'`);
    }

    const accountParam = req.query.account_filter || req.query.account;
    if (accountParam && !["all", "ALL", ""].includes(String(accountParam).trim())) {
      const cleanAccount = String(accountParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_expense.payment_mode = '${cleanAccount}'`);
    }

    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    if (startDate && startDate.trim() !== "") {
      const cleanStart = String(startDate).trim().replace(/'/g, "\\'");
      filterConditions.push(`DATE(tbl_expense.date) >= '${cleanStart}'`);
    }
    if (endDate && endDate.trim() !== "") {
      const cleanEnd = String(endDate).trim().replace(/'/g, "\\'");
      filterConditions.push(`DATE(tbl_expense.date) <= '${cleanEnd}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_expense.id, tbl_expense.date, tbl_expense.amount, tbl_expense.taxpercent, tbl_expense.category, tbl_expense.store_ID, tbl_expense.towards, COALESCE(tbl_exp_cat.cat_name, '') as cat_name, tbl_expense.taxInclud, tbl_expense.payment_mode, COALESCE(tbl_admin.name, '') as created_by_name, COALESCE(tbl_store.name, '') as store_name, COALESCE(tbl_account.ac_name, '') as ac_name`,
      from: `tbl_expense 
             LEFT JOIN tbl_account ON tbl_expense.payment_mode = tbl_account.id 
             LEFT JOIN tbl_admin ON tbl_expense.created_by = tbl_admin.id 
             LEFT JOIN tbl_exp_cat ON tbl_expense.category = tbl_exp_cat.id 
             LEFT JOIN tbl_store ON tbl_expense.store_ID = tbl_store.id`,
      searchColumns: [
        'tbl_expense.towards',
        'tbl_expense.amount',
        'tbl_exp_cat.cat_name',
        'tbl_account.ac_name',
        'tbl_admin.name',
        'tbl_store.name'
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: 'tbl_expense.id DESC',
      columnMap: {
        0: 'tbl_expense.date',
        1: 'tbl_expense.amount',
        2: 'tbl_expense.towards',
        3: 'tbl_expense.taxInclud',
        4: 'tbl_account.ac_name',
        5: 'tbl_store.name',
        6: 'tbl_admin.name'
      },
      postProcess: async (rows) => {
        return rows.map((e) => ({
          id: e.id,
          date: e.date,
          amount: parseFloat(e.amount) || 0,
          towards: e.towards || '',
          taxInclud: e.taxInclud || 'no',
          taxpercent: e.taxpercent || 0,
          payment_mode: e.payment_mode,
          ac_name: e.ac_name || '',
          category: e.category,
          cat_name: e.cat_name || '',
          store_ID: e.store_ID,
          store: e.store_name || '',
          created_by_name: e.created_by_name || '',
          canEdit,
          canDelete
        }));
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Expense list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addexpense", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/list");
    }
    const { id, roll, store, loginas } = req.user;

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("write")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/list");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    let { date, category, amount, payment, tax, notes, tax_percent, storeid } = req.body;
    amount = parseFloat(amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      req.flash("error", "Please enter a valid expense amount");
      return res.redirect("/expense/list");
    }

    let finalStoreId;
    if (!isMaster) {
      if (!assignedStore) {
        req.flash("error", "No store assigned to your account");
        return res.redirect("/expense/list");
      }
      finalStoreId = assignedStore;
    } else {
      finalStoreId = storeid || assignedStore;
      if (!finalStoreId || finalStoreId === '0') {
        req.flash("error", "Please select a store");
        return res.redirect("/expense/list");
      }
    }

    // Validate that category belongs to finalStoreId
    const cleanCat = String(category || '').replace(/['"]/g, '').trim();
    const cleanPayment = String(payment || '').replace(/['"]/g, '').trim();

    const catCheck = await DataFind(`SELECT id FROM tbl_exp_cat WHERE id = '${cleanCat}' AND store_ID = '${finalStoreId}' AND delet_flage = 0`);
    if (!catCheck || catCheck.length === 0) {
      req.flash("error", "Invalid expense category for the selected store");
      return res.redirect("/expense/list");
    }

    // Validate that account/payment belongs to finalStoreId
    const account = await DataFind(`SELECT * FROM tbl_account WHERE id = '${cleanPayment}' AND store_ID = '${finalStoreId}' AND delet_flage != '1'`);
    if (!account || account.length === 0) {
      req.flash("error", "Invalid payment account for the selected store");
      return res.redirect("/expense/list");
    }

    const balance = parseFloat(account[0].balance) - parseFloat(amount);

    const data = await DataUpdate(
      `tbl_account`,
      `balance='${balance}'`,
      `id=${cleanPayment}`,
      req.hostname, req.protocol
    );

    if (data == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/list");
    }

    const cleanNotes = (notes || '').trim().replace(/'/g, "\\'");
    const cleanDate = (date || '').trim().replace(/'/g, "\\'");
    const cleanTax = (tax === 'yes') ? 'yes' : 'no';
    const cleanTaxPercent = (tax === 'yes' && tax_percent) ? parseFloat(tax_percent) || 0 : 0;

    const newentry = await DataInsert(
      `tbl_transections`,
      `account_id,store_ID,transec_detail,transec_type,debit_amount,credit_amount,balance_amount,date, customer_id`,
      `'${cleanPayment}','${account[0].store_ID}','${cleanNotes}','EXPENCE',${amount},0,${balance},'${cleanDate}', '0'`,
      req.hostname,
      req.protocol
    );

    if (newentry == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/list");
    }

    const tansec = newentry.insertId;

    const data3 = await DataInsert(
      `tbl_expense`,
      `date,amount,towards,taxInclud,payment_mode,category,created_by,taxpercent,transection_id,store_ID`,
      `'${cleanDate}','${amount}','${cleanNotes}','${cleanTax}','${cleanPayment}','${cleanCat}','${id}','${cleanTaxPercent}','${tansec}','${finalStoreId}'`,
      req.hostname,
      req.protocol
    );

    if (data3 == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/list");
    }

    req.flash("success", "Expense Added Successfully");
    res.redirect("/expense/list");
  } catch (error) {
    req.flash("error", error.message);
    console.log(error);
    res.redirect("/expense/list");
  }
});

router.post("/updateexp/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/list");
    }
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("edit")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/list");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    const cleanId = String(req.params.id || '').replace(/['"]/g, '').trim();
    if (!cleanId || isNaN(cleanId)) {
      req.flash("error", "Invalid expense ID");
      return res.redirect("/expense/list");
    }

    const expense = await DataFind(`SELECT * FROM tbl_expense WHERE id = ${cleanId} AND delet_flage = 0`);
    if (!expense || expense.length === 0) {
      req.flash("error", "Expense not found");
      return res.redirect("/expense/list");
    }

    // Enforce store scoping
    if (!isMaster && String(expense[0].store_ID) !== String(assignedStore)) {
      req.flash("error", "You can only update expenses for your assigned store");
      return res.redirect("/expense/list");
    }

    const expenseStoreId = expense[0].store_ID;

    let {
      date_update,
      expense_category,
      amount_update,
      payment_update,
      tax,
      notes_update,
      tax_percent,
    } = req.body;

    amount_update = parseFloat(amount_update);
    if (!amount_update || isNaN(amount_update) || amount_update <= 0) {
      req.flash("error", "Please enter a valid expense amount");
      return res.redirect("/expense/list");
    }

    const cleanCat = String(expense_category || '').replace(/['"]/g, '').trim();
    const cleanPayment = String(payment_update || '').replace(/['"]/g, '').trim();

    // Validate that category belongs to this expense's store
    const catCheck = await DataFind(`SELECT id FROM tbl_exp_cat WHERE id = '${cleanCat}' AND store_ID = '${expenseStoreId}'`);
    if (!catCheck || catCheck.length === 0) {
      req.flash("error", "Invalid category selected for this store");
      return res.redirect("/expense/list");
    }

    // Validate that payment account belongs to this expense's store
    const accountCheck = await DataFind(`SELECT id FROM tbl_account WHERE id = '${cleanPayment}' AND store_ID = '${expenseStoreId}'`);
    if (!accountCheck || accountCheck.length === 0) {
      req.flash("error", "Invalid payment account selected for this store");
      return res.redirect("/expense/list");
    }

    const transection = await DataFind(`SELECT * FROM tbl_transections WHERE id = ${expense[0].transection_id}`);
    const cleanNotes = (notes_update || '').trim().replace(/'/g, "\\'");
    const cleanDate = (date_update || '').trim().replace(/'/g, "\\'");
    const cleanTax = (tax === 'yes') ? 'yes' : 'no';
    const cleanTaxPercent = (tax === 'yes' && tax_percent) ? parseFloat(tax_percent) || 0 : 0;

    if (transection && transection.length > 0 && String(transection[0].account_id) === String(cleanPayment)) {
      const account = await DataFind(`SELECT * FROM tbl_account WHERE id = ${cleanPayment}`);
      const balance = parseFloat(account[0].balance) + parseFloat(expense[0].amount - amount_update);

      if (await DataUpdate(
        `tbl_account`,
        `balance='${balance}'`,
        `id=${cleanPayment}`,
        req.hostname, req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("/expense/list");
      }

      if (await DataUpdate(
        `tbl_transections`,
        `transec_detail='${cleanNotes}',debit_amount=${amount_update},balance_amount=${balance},date='${cleanDate}'`,
        `id=${expense[0].transection_id}`,
        req.hostname, req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("/expense/list");
      }
    } else if (transection && transection.length > 0) {
      const oldaccount = await DataFind(`SELECT * FROM tbl_account WHERE id = ${transection[0].account_id}`);
      const oldaccbalance = parseFloat(oldaccount[0].balance) + parseFloat(expense[0].amount);

      if (await DataUpdate(
        `tbl_account`,
        `balance='${oldaccbalance}'`,
        `id=${transection[0].account_id}`,
        req.hostname, req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("/expense/list");
      }

      const newaccount = await DataFind(`SELECT * FROM tbl_account WHERE id = ${cleanPayment}`);
      const newaccbalance = parseFloat(newaccount[0].balance) - parseFloat(amount_update);

      if (await DataUpdate(
        `tbl_account`,
        `balance='${newaccbalance}'`,
        `id=${cleanPayment}`,
        req.hostname, req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("/expense/list");
      }

      if (await DataUpdate(
        `tbl_transections`,
        `account_id='${cleanPayment}',transec_detail='${cleanNotes}',debit_amount=${amount_update},balance_amount=${newaccbalance},date='${cleanDate}'`,
        `id=${expense[0].transection_id}`,
        req.hostname, req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("/expense/list");
      }
    }

    if (await DataUpdate(
      `tbl_expense`,
      `date='${cleanDate}',amount='${amount_update}',towards='${cleanNotes}',taxInclud='${cleanTax}',payment_mode='${cleanPayment}',category='${cleanCat}',taxpercent=${cleanTaxPercent}`,
      `id=${cleanId}`,
      req.hostname, req.protocol) == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/list");
    }

    req.flash("success", "Expense Updated Successfully");
    res.redirect("/expense/list");
  } catch (error) {
    req.flash("error", error.message);
    console.log(error);
    res.redirect("/expense/list");
  }
});

router.get("/deletexpe/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/expense/list");
    }
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].expense || !rolldetail[0].expense.includes("delete")) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/expense/list");
    }

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore = (adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== '0') ? String(adminData[0].store_ID) : (store ? String(store) : '');
    const isMaster = rolldetail[0].rollType.includes("master") && !isStaff && (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === '0');

    const cleanId = String(req.params.id || '').replace(/['"]/g, '').trim();
    if (!cleanId || isNaN(cleanId)) {
      req.flash("error", "Invalid expense ID");
      return res.redirect("/expense/list");
    }

    const expense = await DataFind(`SELECT * FROM tbl_expense WHERE id = ${cleanId}`);
    if (!expense || expense.length === 0) {
      req.flash("error", "Expense not found");
      return res.redirect("/expense/list");
    }

    if (!isMaster && String(expense[0].store_ID) !== String(assignedStore)) {
      req.flash("error", "You can only delete expenses for your assigned store");
      return res.redirect("/expense/list");
    }

    if (await DataUpdate(
      `tbl_expense`,
      `delet_flage=1`,
      `id=${cleanId}`,
      req.hostname, req.protocol) == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("/expense/list");
    }

    req.flash("success", "Expense Deleted Successfully");
    res.redirect("/expense/list");
  } catch (error) {
    console.log(error);
    req.flash("error", "Something went wrong");
    res.redirect("/expense/list");
  }
});

module.exports = router;
