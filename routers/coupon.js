const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey")

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
      const couponList = await DataFind(
        "SELECT tbl_coupon.*,(SELECT GROUP_CONCAT(`name`) from `tbl_store` WHERE find_in_set(tbl_store.id,tbl_coupon.store_list_id)) as storeList FROM tbl_coupon"
      );

      res.render("coupon", {
        mlty,
        isadmin: true,
        storeList,
        couponList,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].coupon.includes("read")
    ) {
      const couponList = await DataFind(
        "SELECT * FROM tbl_coupon WHERE find_in_set('" +
          store +
          "',tbl_coupon.store_list_id);"
      );
      console.log("store", store);

      const storeList = await DataFind(
        `SELECT id,name FROM tbl_store WHERE status=1 AND  id='${store}'  AND delete_flage=0`
      );
      res.render("coupon", {
        mlty: false,
        isadmin: false,
        storeList: storeList,
        couponList,
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
      storelist
        ? Array.isArray(storelist)
          ? (storelist = storelist.join(","))
          : storelist
        : (storelist = 1);

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
  req.flash('error', process.env.dataerror);
  return res.redirect("/validate");
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
      // var qury = ` DELETE FROM  tbl_coupon WHERE id = ${dataid}`;

    if(await DataDelete(`tbl_coupon`, `id = '${dataid}'`, req.hostname, req.protocol) == -1) {
            req.flash('error', process.env.dataerror);
            return res.redirect("/validate");
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
      storelist
        ? Array.isArray(storelist)
          ? (storelist = storelist.join(","))
          : storelist
        : (storelist = 1);
      status ? (status = 0) : (status = 1);

      


      const coupondata = await DataUpdate(
        `tbl_coupon`,
        `titel='${coupon_titel_update}',min_purchase='${coupon_purchase_update}',discount='${coupon_discount_amount_update}',start_date='${coupon_start_date_update}',end_date='${coupon_end_date_update}',
         store_list_id='${storelist}',coupon_type='${coupon_type_update}',limit_forsame_user='${coupon_limit_update}',status='${status}'`,
        `id=${dataid}`,
        req.hostname,
        req.protocol
      );
      if (coupondata == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
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
