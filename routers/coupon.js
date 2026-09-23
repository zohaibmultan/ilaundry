const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey");
const { paginateDataTable } = require("../middelwer/dataTableHelper");

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

    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].coupon.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var mlty = true;
      } else {
        var mlty = false;
      }
      const storeList = await DataFind(
        "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
      );

      res.render("coupon", {
        mlty,
        isadmin: true,
        canAdd: rolldetail[0].coupon.includes("write"),
        canEdit: rolldetail[0].coupon.includes("edit"),
        canDelete: rolldetail[0].coupon.includes("delete"),
        storeList,
        couponList: [],
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].coupon.includes("read")
    ) {
      const storeList = await DataFind(
        `SELECT id,name FROM tbl_store WHERE status=1 AND id='${store}' AND delete_flage=0`
      );
      res.render("coupon", {
        mlty: false,
        isadmin: false,
        canAdd: rolldetail[0].coupon.includes("write"),
        canEdit: rolldetail[0].coupon.includes("edit"),
        canDelete: rolldetail[0].coupon.includes("delete"),
        storeList: storeList,
        couponList: [],
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

    if (!rolldetail || rolldetail.length === 0 || !rolldetail[0].coupon || !rolldetail[0].coupon.includes("read")) {
      return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
    }

    const isMaster = rolldetail[0].rollType === "master";
    const canEdit = rolldetail[0].coupon.includes("edit");
    const canDelete = rolldetail[0].coupon.includes("delete");

    const scopeConditions = [];
    if (!isMaster) {
      scopeConditions.push(`FIND_IN_SET('${store}', tbl_coupon.store_list_id)`);
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (statusParam !== undefined && statusParam !== null && !["all", "ALL", ""].includes(String(statusParam).trim())) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_coupon.status = '${cleanStatus}'`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (storeParam && isMaster && !["all", "ALL", "", "0"].includes(String(storeParam).trim())) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`FIND_IN_SET('${cleanStore}', tbl_coupon.store_list_id)`);
    }

    const typeParam = req.query.type_filter || req.query.type;
    if (typeParam && !["all", "ALL", ""].includes(String(typeParam).trim())) {
      const cleanType = String(typeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_coupon.coupon_type = '${cleanType}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_coupon.*, (SELECT GROUP_CONCAT(name SEPARATOR ', ') FROM tbl_store WHERE FIND_IN_SET(tbl_store.id, tbl_coupon.store_list_id)) as storeList`,
      from: `tbl_coupon`,
      searchColumns: [
        'tbl_coupon.titel',
        'tbl_coupon.code',
        'tbl_coupon.coupon_type',
        'tbl_coupon.discount',
        'tbl_coupon.min_purchase'
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: 'tbl_coupon.id DESC',
      columnMap: {
        0: 'tbl_coupon.id',
        1: 'tbl_coupon.titel',
        2: 'tbl_coupon.code',
        3: 'tbl_coupon.min_purchase',
        4: 'tbl_coupon.discount',
        5: 'tbl_coupon.start_date',
        6: 'tbl_coupon.end_date',
        7: 'tbl_coupon.status'
      },
      postProcess: async (rows) => {
        return rows.map((c) => ({
          id: c.id,
          titel: c.titel || '',
          code: c.code || '',
          min_purchase: parseFloat(c.min_purchase) || 0,
          discount: parseFloat(c.discount) || 0,
          start_date: c.start_date || '',
          end_date: c.end_date || '',
          status: parseInt(c.status) || 0,
          store_list_id: c.store_list_id || '',
          storeList: c.storeList || '',
          coupon_type: c.coupon_type || '',
          limit_forsame_user: c.limit_forsame_user || 1,
          isadmin: isMaster,
          canEdit,
          canDelete
        }));
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Coupon list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/add", auth, async (req, res) => {
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

    if (rolldetail[0].coupon.includes("write")) {
      var {
        coupon_titel,
        coupon_code,
        coupon_type,
        coupon_limit,
        coupon_start_date,
        coupon_end_date,
        coupon_purchase,
        coupon_discount_amount,
        storelist,
      } = req.body;
      if (rolldetail[0].rollType === "store") {
        storelist = String(store);
      } else {
        storelist = storelist
          ? (Array.isArray(storelist) ? storelist.join(",") : storelist)
          : "1";
      }

      const samecoupon = await DataFind(
        "SELECT * FROM tbl_coupon WHERE code = '" + coupon_code + "' "
      );
      if (samecoupon.length > 0) {
        req.flash("error", "This Coupon Code Alredy Resister");
        return res.redirect(req.get("Referrer") || "/");
      }

     

const coupondata = await DataInsert(
  `tbl_coupon`,
  `titel,code,min_purchase,discount,start_date,end_date,store_list_id,coupon_type,limit_forsame_user`,
  `'${coupon_titel}','${coupon_code}',${coupon_purchase},${coupon_discount_amount},'${coupon_start_date}','${coupon_end_date}','${storelist}','${coupon_type}', ${coupon_limit}`,
  req.hostname,
  req.protocol
);

if (coupondata == -1) {
  req.flash('error', "Failed to add coupon, please check input and try again");
  return res.redirect("back");
}



      req.flash("success", "New Coupon Added!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/delete/:id", auth, async (req, res) => {
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

    if (rolldetail[0].coupon.includes("delete")) {
      var dataid = req.params.id;
      let deleteWhere = `id = '${dataid}'`;
      if (rolldetail[0].rollType === "store") {
        deleteWhere += ` AND FIND_IN_SET('${store}', store_list_id)`;
      }

      if(await DataDelete(`tbl_coupon`, deleteWhere, req.hostname, req.protocol) == -1) {
            req.flash('error', "Failed to delete coupon, please try again");
            return res.redirect("back");
        }
      
      // var coupondata = await DataFind(qury);

      req.flash("success", "Coupon Delete");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/update/:id", auth, async (req, res) => {
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

    if (rolldetail[0].coupon.includes("edit")) {
      var dataid = req.params.id;
      var {
        coupon_titel_update,
        storelist,
        coupon_type_update,
        coupon_limit_update,
        coupon_start_date_update,
        coupon_end_date_update,
        coupon_purchase_update,
        coupon_discount_amount_update,
        status,
      } = req.body;
      if (rolldetail[0].rollType === "store") {
        storelist = String(store);
      } else {
        storelist = storelist
          ? (Array.isArray(storelist) ? storelist.join(",") : storelist)
          : "1";
      }
      status ? (status = 0) : (status = 1);

      let updateWhere = `id=${dataid}`;
      if (rolldetail[0].rollType === "store") {
        updateWhere += ` AND FIND_IN_SET('${store}', store_list_id)`;
      }

      const coupondata = await DataUpdate(
        `tbl_coupon`,
        `titel='${coupon_titel_update}',min_purchase='${coupon_purchase_update}',discount='${coupon_discount_amount_update}',start_date='${coupon_start_date_update}',end_date='${coupon_end_date_update}',
         store_list_id='${storelist}',coupon_type='${coupon_type_update}',limit_forsame_user='${coupon_limit_update}',status='${status}'`,
        updateWhere,
        req.hostname,
        req.protocol
      );
      if (coupondata == -1) {
        req.flash("error", "Failed to update coupon, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Coupon Update !!");
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
