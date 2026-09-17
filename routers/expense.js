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
      var dataid = req.params.id;
      const name = req.body.name;
      // var qury =
      //   "UPDATE tbl_exp_cat_type SET type_name='" +
      //   name +
      //   "' WHERE id=" +
      //   dataid +
      //   "";
      // const data = await DataFind(qury);

       const data = await DataUpdate(
        `tbl_exp_cat_type`,
        `type_name='${name}'`,
        `id=${dataid}`,
        req.hostname,req.protocol);


      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
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
      var dataid = req.params.id;

      // var qury = "UPDATE tbl_exp_cat_type SET delet_flage=1 WHERE id=" + dataid + ""; 
      // const data = await DataFind(qury);

       const data = await DataUpdate(
        `tbl_exp_cat_type`,
        `delet_flage=1`,
        `id=${dataid}`,
        req.hostname,req.protocol);


      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
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
    var id = req.params.id;
    // console.log("id",id);
    
    const data = await DataFind("SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0 AND store_ID=" + id +"");
    console.log("data", data);

    res.status(200).json({ data: data });
  } catch (error) {
    console.log(error);
  }
});

// Expense Category
router.get("/categorylist", auth, async (req, res) => {
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
      const data = await DataFind(
        "SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0 AND store_ID='" +
          store +
          "'"
      );
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var qury = `SELECT tbl_exp_cat.id,tbl_exp_cat.store_ID,tbl_exp_cat.exp_cat_type_id,tbl_exp_cat.cat_name,tbl_exp_cat.delet_flage,
                tbl_exp_cat_type.type_name,tbl_store.name as store FROM tbl_exp_cat join tbl_exp_cat_type on tbl_exp_cat.exp_cat_type_id=tbl_exp_cat_type.id join tbl_store on tbl_exp_cat.store_ID=tbl_store.id
                WHERE tbl_exp_cat.delet_flage=0`;
        var ismulty = true;
      } else {
        var storeID = await DataFind(
          `SELECT * FROM tbl_admin WHERE  id= ${id}`
        );

        var qury = `SELECT tbl_exp_cat.id,tbl_exp_cat.store_ID,tbl_exp_cat.exp_cat_type_id,tbl_exp_cat.cat_name,tbl_exp_cat.delet_flage,
                tbl_exp_cat_type.type_name,tbl_store.name as store FROM tbl_exp_cat join tbl_exp_cat_type on tbl_exp_cat.exp_cat_type_id=tbl_exp_cat_type.id join tbl_store on tbl_exp_cat.store_ID=tbl_store.id
                WHERE tbl_exp_cat.delet_flage=0 AND tbl_exp_cat.store_ID='${storeID[0].store_ID}' `;
        var ismulty = false;
      }

      res.render("expenceCategory", {
        type: data,
        list: [],
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
      const data = await DataFind(
        "SELECT * FROM tbl_exp_cat_type WHERE delet_flage=0 AND store_ID=" +
          store +
          ""
      );

      res.render("expenceCategory", {
        type: data,
        list: [],
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

    const isMaster = rolldetail[0].rollType.includes("master");
    const canEdit = rolldetail[0].expense.includes("edit");
    const canDelete = rolldetail[0].expense.includes("delete");

    const scopeConditions = [`tbl_exp_cat.delet_flage = 0`];
    if (!isMaster) {
      scopeConditions.push(`tbl_exp_cat.store_ID = '${store}'`);
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
      var { name, type_id, storeid } = req.body;
      storeid ? storeid : (storeid = store);

      // const data = await DataFind(
      //   "INSERT INTO tbl_exp_cat (exp_cat_type_id,cat_name,store_ID) VALUE ('" +
      //     type_id +
      //     "','" +
      //     name +
      //     "', " +
      //     storeid +
      //     ") "
      // );


const data2 = await DataInsert(
  `tbl_exp_cat`,
  `exp_cat_type_id,cat_name,store_ID`,
  `'${type_id}','${name}', ${storeid}`,
  req.hostname,
  req.protocol
);

if (data2 == -1) {
  req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
}


      req.flash("success", "Expense Category Added");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updateexpcat/:id", auth, async (req, res) => {
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
      var dataid = req.params.id;
      var cattypid = req.body.type_id;
      var name = req.body.name;

      // var qury =
      //   "UPDATE tbl_exp_cat SET exp_cat_type_id='" +
      //   cattypid +
      //   "',cat_name='" +
      //   name +
      //   "' WHERE id=" +
      //   dataid +
      //   "";
      // const data = await DataFind(qury);

        const data = await DataUpdate(
        `tbl_exp_cat_type`,
        `exp_cat_type_id='${cattypid}',
         cat_name='${name}'`,
        `id=${dataid}`,
        req.hostname,req.protocol);

      if(data == -1){
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
      }


      req.flash("success", "Expense Category Updated");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/deletexpcat/:id", auth, async (req, res) => {
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
      var dataid = req.params.id;
      // var qury =
      //   "UPDATE tbl_exp_cat SET delet_flage= 1 WHERE id=" + dataid + "";
      // const data = await DataFind(qury);


const data = await DataUpdate(
        `tbl_exp_cat_type`,
        `delet_flage= 1`,
        `id=${dataid}`,
        req.hostname,req.protocol);

      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
      }


      req.flash("success", "Expense Category Updated");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

// <<<<<<<<<<<<<<< expense category list and account by store id >>>>>>>>>>>>>>>>>
router.get("/expcatlist/:id", auth, async (req, res) => {
  try {
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
      var dataid = req.params.id;

      var qury = `SELECT id,cat_name FROM tbl_exp_cat WHERE delet_flage=0 AND store_ID= ${dataid} `;
      const data = await DataFind(qury);
      const acountlist = await DataFind(
        "SELECT id, ac_name From tbl_account WHERE store_ID=" +
          dataid +
          " AND  delet_flage !='1' "
      );

      res.status(200).json({ data: data, acountlist });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
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

    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
    );
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    let ismulty = false;
    let account = "SELECT id, ac_name From tbl_account WHERE store_ID=0 AND delet_flage !='1'";
    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].expense.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        ismulty = true;
        account = "SELECT id, ac_name From tbl_account WHERE store_ID=0 AND delet_flage !='1'";
      } else {
        const storeID = await DataFind(`SELECT * FROM tbl_admin WHERE id= ${id}`);
        ismulty = false;
        account = `SELECT id, ac_name From tbl_account WHERE store_ID='${storeID[0].store_ID}' AND delet_flage !='1'`;
      }
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].expense.includes("read")
    ) {
      ismulty = false;
      account = "SELECT id, ac_name From tbl_account WHERE store_ID=" + store + " AND delet_flage !='1'";
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const expencategory = await DataFind(
      "SELECT id,cat_name FROM tbl_exp_cat WHERE delet_flage !=1"
    );
    const acountlist = await DataFind(account);

    res.render("expensList", {
      categ: expencategory,
      expenlist: [],
      ismulty,
      storeList,
      acountlist,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
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

    const isMaster = rolldetail[0].rollType === "master";
    const canEdit = rolldetail[0].expense.includes("edit");
    const canDelete = rolldetail[0].expense.includes("delete");

    const scopeConditions = [`tbl_expense.delet_flage = 0`];
    if (!isMaster) {
      scopeConditions.push(`tbl_expense.store_ID = '${store}'`);
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
      const { date, category, amount, payment, tax, notes, tax_percent } =
        req.body;

      var storeid = req.body.storeid;
      storeid ? storeid : (storeid = store);

      const account = await DataFind(
        "SELECT * FROM tbl_account WHERE id=" + payment + ""
      );
      const balance = parseFloat(account[0].balance) - parseFloat(amount);

      // await DataFind(
      //   "UPDATE tbl_account SET balance=" +
      //     balance +
      //     " WHERE id=" +
      //     payment +
      //     " "
      // );


      const data = await DataUpdate(
        `tbl_account`,
        `balance='${balance}'`,
        `id=${payment}`,
         req.hostname,req.protocol);

      if (data == -1) {
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
      }

      // var newentry =
      //   await DataFind(`insert into tbl_transections (account_id,store_ID,transec_detail,transec_type,debit_amount,
      //               credit_amount,balance_amount,date, customer_id) VALUE ('${payment}','${account[0].store_ID}','${notes}','EXPENCE',
      //               ${amount},0,${balance},'${date}', '0')`);

        var newentry = await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,debit_amount,credit_amount,balance_amount,date, customer_id`,
          `'${payment}','${account[0].store_ID}','${notes}','EXPENCE',${amount},0,${balance},'${date}', '0'`,
          req.hostname,
          req.protocol
        )

         if ((newentry) == -1) {
         req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
        }


      var tansec = newentry.insertId;

      // var qury =
      //   "INSERT INTO tbl_expense (date,amount,towards,taxInclud,payment_mode,category,created_by,taxpercent,transection_id,store_ID) VALUE ('" +
      //   date +
      //   "','" +
      //   amount +
      //   "','" +
      //   notes +
      //   "','" +
      //   tax +
      //   "','" +
      //   payment +
      //   "','" +
      //   category +
      //   "','" +
      //   id +
      //   "','" +
      //   tax_percent +
      //   "','" +
      //   tansec +
      //   "','" +
      //   storeid +
      //   "')";
      // const data = await DataFind(qury);

const data3 = await DataInsert(
  `tbl_expense`,
  `date,amount,towards,taxInclud,payment_mode,category,created_by,taxpercent,transection_id,store_ID`,
  `'${date}','${amount}','${notes}','${tax}','${payment}','${category}','${id}','${tax_percent}','${tansec}','${storeid}'`,
  req.hostname,
  req.protocol
);

if (data3 == -1) {
  req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
}



      req.flash("success", "Expense Add Success ");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    req.flash("error", error.message);
    console.log(error);
  }
});

router.post("/updateexp/:id", auth, async (req, res) => {
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
      var dataid = req.params.id;
      const {
        date_update,
        expense_category,
        amount_update,
        payment_update,
        tax,
        notes_update,
        tax_percent,
      } = req.body;

      const expense = await DataFind(
        "SELECT * FROM tbl_expense WHERE id=" + dataid + ""
      );
      const transection = await DataFind(
        " SELECT * FROM tbl_transections WHERE id=" +
          expense[0].transection_id +
          ""
      );

      if (transection[0].account_id == payment_update) {
        const account = await DataFind(
          "SELECT * FROM tbl_account WHERE id=" + payment_update + ""
        );
        const balance =
          parseFloat(account[0].balance) +
          parseFloat(expense[0].amount - amount_update);

        // await DataFind(
        //   "UPDATE tbl_account SET balance=" +
        //     balance +
        //     " WHERE id=" +
        //     payment_update +
        //     " "
        // );

     

      if (await DataUpdate(
        `tbl_account`,
        `balance='${balance}'`,
        `id=${payment_update}`,
        req.hostname,req.protocol) == -1) {
        req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
      }

        // await DataFind(`UPDATE tbl_transections SET transec_detail='${notes_update}',debit_amount=${amount_update},
        //         balance_amount=${balance},date='${date_update}' WHERE id=${expense[0].transection_id}`);


        if(await DataUpdate(
                `tbl_transections`,
                `transec_detail='${notes_update}',debit_amount=${amount_update},balance_amount=${balance},date='${date_update}'`,
                `id=${expense[0].transection_id}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }


      } else {
        const oldaccount = await DataFind(
          "SELECT * FROM tbl_account WHERE id=" + transection[0].account_id + ""
        );
        const oldaccbalance =
          parseFloat(oldaccount[0].balance) + parseFloat(expense[0].amount);

        // await DataFind(
        //   "UPDATE tbl_account SET balance=" +
        //     oldaccbalance +
        //     " WHERE id=" +
        //     transection[0].account_id +
        //     " "
        // );

             if(await DataUpdate(
                `tbl_account`,
                `balance='${oldaccbalance}'`,
                `id=${transection[0].account_id}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }


        const newaccount = await DataFind(
          "SELECT * FROM tbl_account WHERE id=" + payment_update + ""
        );
        const newaccbalance =
          parseFloat(newaccount[0].balance) - parseFloat(amount_update);



        // await DataFind(
        //   "UPDATE tbl_account SET balance=" +
        //     newaccbalance +
        //     " WHERE id=" +
        //     payment_update +
        //     " "
        // );


              if(await DataUpdate(
                `tbl_account`,
                `balance='${newaccbalance}'`,
                `id=${payment_update}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }




        // await DataFind(`UPDATE tbl_transections SET account_id='${payment_update}', transec_detail='${notes_update}',
        //         debit_amount=${amount_update}, balance_amount=${newaccbalance}, date='${date_update}' WHERE id=${expense[0].transection_id}`);


 if(await DataUpdate(
                `tbl_transections`,
                `account_id='${payment_update}',transec_detail='${notes_update}',
                debit_amount=${amount_update}, balance_amount=${newaccbalance}, date='${date_update}'`,
                `id=${expense[0].transection_id}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }


      }

      // var qury = `UPDATE tbl_expense SET date='${date_update}',amount='${amount_update}',towards='${notes_update}',
      //   taxInclud='${tax}',payment_mode='${payment_update}',category='${expense_category}', taxpercent=${tax_percent} WHERE id=${dataid}`;
      // const data = await DataFind(qury);

        if(await DataUpdate(
                `tbl_expense`,
                `date='${date_update}',amount='${amount_update}',towards='${notes_update}',
                taxInclud='${tax}',payment_mode='${payment_update}',category='${expense_category}', taxpercent=${tax_percent}`,
                `id=${dataid}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }


      req.flash("success", "Expense Updated");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {}
});

router.get("/deletexpe/:id", auth, async (req, res) => {
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
      var dataid = req.params.id;

      // var qury = `UPDATE tbl_expense SET delet_flage=1 WHERE id=${dataid}`;

      // const data = await DataFind(qury);

if(await DataUpdate(
                `tbl_expense`,
                `delet_flage=1'`,
                `id=${dataid}`,
                req.hostname,req.protocol) == -1) {
                req.flash("error", "Action failed, please check input and try again"); return res.redirect("back");
              }



      req.flash("success", "Expense Deleted");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

module.exports = router;
