const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
var timezones = require("timezones-list");
const access = require("../middelwer/access");
const bcrypt = require("bcrypt");
const XLSX = require("xlsx");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind,
} = require("../middelwer/databaseQurey");

const { paginateDataTable } = require("../middelwer/dataTableHelper");
const { invalidateMultiLanguageCache } = require("../middelwer/language");
const {
  NOTIFICATION_EVENTS,
  TEMPLATE_VARIABLES,
  getEffectiveNotificationSettings,
  saveNotificationSettings,
  saveNotificationTemplates,
  resetNotificationTemplates,
  saveEmailAndTwilioGateways,
  resetStoreNotificationSettings,
  sendTestNotification,
  resolveSmtpConfig,
  resolveTwilioConfig,
  resolveOpenWaConfig,
  getOpenWaSessionStatusAndQr,
  controlOpenWaSession,
} = require("../services/notificationService");

function normalizePermValue(val) {
  if (!val) return "";
  return Array.isArray(val) ? val.filter(Boolean).join(",") : String(val);
}

function buildRoleCopyFields(roleRow, fallbacks = {}) {
  const r = roleRow || {};
  return {
    customers: r.customers || r.customer || fallbacks.customers || "",
    orders: r.orders || fallbacks.orders || "",
    expense: r.expense || fallbacks.expense || "",
    service: r.service || fallbacks.service || "",
    reports: r.reports || fallbacks.reports || "",
    tools: r.tools || fallbacks.tools || "",
    mail: r.mail || fallbacks.mail || "",
    master: r.master || fallbacks.master || "",
    sms: r.sms || fallbacks.sms || "",
    staff: r.staff || fallbacks.staff || "",
    pos: r.pos || fallbacks.pos || "",
    rollaccess: r.rollaccess || fallbacks.rollaccess || "",
    account: r.account || fallbacks.account || "",
    coupon: r.coupon || fallbacks.coupon || "",
    branch_n_store: r.branch_n_store || fallbacks.branch_n_store || "",
    master_setting: r.master_setting || fallbacks.master_setting || "",
    Pay_Out: r.Pay_Out || fallbacks.Pay_Out || "",
    notification_setting: r.notification_setting || fallbacks.notification_setting || "",
    notification_templates: r.notification_templates || fallbacks.notification_templates || "",
    store_setting: r.store_setting || fallbacks.store_setting || "",
    printer_setting: r.printer_setting || fallbacks.printer_setting || "",
    all_staff_records: r.all_staff_records || fallbacks.all_staff_records || "",
    customer_credentials: r.customer_credentials || fallbacks.customer_credentials || "",
    pickup_requests: r.pickup_requests || fallbacks.pickup_requests || "",
    racks: r.racks || fallbacks.racks || "",
    route_calendar: r.route_calendar || fallbacks.route_calendar || "",
    pos_price_discount_override: r.pos_price_discount_override || fallbacks.pos_price_discount_override || "",
    order_payment_collect: r.order_payment_collect || fallbacks.order_payment_collect || "",
    financial_reports: r.financial_reports || fallbacks.financial_reports || "",
  };
}

// <<<<<<<<<<roll >>>>>>>>>>>>>>>>>

router.get("/roll", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    console.log("accessdata", accessdata);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");

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
      rolldetail[0].rollaccess.includes("read")
    ) {
      if (multiy[0].type == 1) {
        var ismulty = true;
        const storeList = await DataFind(
          "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
        );

        res.render("roll", {
          rollList: [],
          ismulty,
          storeList,
          accessdata,
          language: req.language_data,
          language_name: req.language_name,
        });
      } else {
        res.render("roll", {
          rollList: [],
          ismulty: false,
          storeList: [],
          accessdata,
          language: req.language_data,
          language_name: req.language_name,
        });
      }
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].rollaccess.includes("read")
    ) {
      res.render("roll", {
        rollList: [],
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

router.get("/roll/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.roll_status;
    if (
      statusParam &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_roll.roll_status = '${cleanStatus}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      (accessdata.logas === "master" ||
        (accessdata.roll &&
          accessdata.roll.rollaccess &&
          accessdata.roll.rollaccess.includes("edit"))),
    );
    const canDelete = Boolean(
      accessdata &&
      (accessdata.logas === "master" ||
        (accessdata.roll &&
          accessdata.roll.rollaccess &&
          accessdata.roll.rollaccess.includes("delete"))),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_roll.id, tbl_roll.roll, tbl_roll.rollType, tbl_roll.roll_status, tbl_roll.delet_flage`,
      from: `tbl_roll`,
      searchColumns: [
        "tbl_roll.roll",
        "tbl_roll.rollType",
        "tbl_roll.roll_status",
      ],
      baseWhere: ["tbl_roll.delet_flage = 0"],
      filterWhere: filterConditions,
      defaultOrder: "tbl_roll.id ASC",
      columnMap: {
        0: "tbl_roll.id",
        1: "tbl_roll.roll",
        2: "tbl_roll.roll_status",
      },
      postProcess: async (rows) => {
        return rows.map((r) => ({
          id: r.id,
          roll: r.roll,
          rollType: r.rollType,
          roll_status: r.roll_status,
          canEdit,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Roll data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addroll", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
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
    if (rolldetail[0].rollaccess.includes("write") || accessdata.logas === "master") {
      var {
        name,
        rollType,
        orders,
        expense,
        service,
        reports,
        tools,
        mail,
        master,
        sms,
        staff,
        Pay_Out,
        customers,
        branch_n_store,
        pos,
        rollname,
        master_setting,
        couponname,
        accountname,
        notification_setting,
        notification_templates,
        store_setting,
        printer_setting,
        all_staff_records,
        customer_credentials,
        pickup_requests,
        racks,
        route_calendar,
        pos_price_discount_override,
        order_payment_collect,
        financial_reports,
      } = req.body;
      var storeid = req.body.storeid;
      storeid ? storeid : (storeid = store);

      const safeRollType = rollType === "master" ? "master" : "store";
      orders = normalizePermValue(orders);
      branch_n_store = normalizePermValue(branch_n_store);
      Pay_Out = normalizePermValue(Pay_Out);
      master_setting = normalizePermValue(master_setting);
      expense = normalizePermValue(expense);
      service = normalizePermValue(service);
      customers = normalizePermValue(customers);
      reports = normalizePermValue(reports);
      tools = normalizePermValue(tools);
      mail = normalizePermValue(mail);
      master = normalizePermValue(master);
      sms = normalizePermValue(sms);
      staff = normalizePermValue(staff);
      pos = normalizePermValue(pos);
      rollname = normalizePermValue(rollname);
      couponname = normalizePermValue(couponname);
      accountname = normalizePermValue(accountname);
      notification_setting = normalizePermValue(notification_setting);
      notification_templates = normalizePermValue(notification_templates);
      store_setting = normalizePermValue(store_setting);
      printer_setting = normalizePermValue(printer_setting);
      all_staff_records = normalizePermValue(all_staff_records);
      customer_credentials = normalizePermValue(customer_credentials);
      pickup_requests = normalizePermValue(pickup_requests);
      racks = normalizePermValue(racks);
      route_calendar = normalizePermValue(route_calendar);
      pos_price_discount_override = normalizePermValue(pos_price_discount_override);
      order_payment_collect = normalizePermValue(order_payment_collect);
      financial_reports = normalizePermValue(financial_reports);
      if (store_setting && !master) {
        master = store_setting;
      } else if (master && !store_setting) {
        store_setting = master;
      }

      const newroll = await DataInsert(
        `tbl_roll`,
        `roll, rollType, customers,orders,  expense, service, reports, tools,  mail, master, sms, staff, pos, rollaccess, account, coupon, branch_n_store, master_setting, Pay_Out, notification_setting, notification_templates, store_setting, printer_setting, all_staff_records, customer_credentials, pickup_requests, racks, route_calendar, pos_price_discount_override, order_payment_collect, financial_reports, roll_status, delet_flage`,
        `'${String(name || "").replace(/'/g, "\\'")}','${safeRollType}','${customers}','${orders}','${expense}','${service}','${reports}','${tools}','${mail}','${master}','${sms}','${staff}','${pos}','${rollname}','${accountname}','${couponname}','${branch_n_store}','${master_setting}','${Pay_Out}', '${notification_setting}', '${notification_templates}', '${store_setting}', '${printer_setting}', '${all_staff_records}', '${customer_credentials}', '${pickup_requests}', '${racks}', '${route_calendar}', '${pos_price_discount_override}', '${order_payment_collect}', '${financial_reports}', 'active', 0`,
        req.hostname,
        req.protocol,
      );

      if (newroll == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Roll Added !");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/deletroll/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
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

    if (rolldetail[0].rollaccess.includes("delete")) {
      var rollid = req.params.id;

      // const newroll = await DataFind(
      //   "DELETE FROM tbl_roll  WHERE id=" + rollid + " "
      // );

      if (
        (await DataDelete(
          `tbl_roll`,
          `id = '${rollid}'`,
          req.hostname,
          req.protocol,
        )) == -1
      ) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Roll Deleted  !!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/rolldetails/:id", auth, async (req, res) => {
  try {
    const id = req.params.id;
    const newroll = await DataFind(
      "SELECT * FROM tbl_roll WHERE id=" + id + " ",
    );
    res.status(200).json({ rolldata: newroll[0] });
  } catch (error) {
    console.log(error);
  }
});

router.post("/updateroll/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
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
    if (rolldetail[0].rollaccess.includes("edit") || accessdata.logas === "master") {
      const rollid = req.params.id;
      var {
        name_update,
        orders,
        expense,
        service,
        reports,
        tools,
        rollType,
        mail,
        master,
        customers,
        master_setting,
        sms,
        Pay_Out,
        branch_n_store,
        staff,
        pos,
        rollname,
        active,
        couponname,
        accountname,
        notification_setting,
        notification_templates,
        store_setting,
        printer_setting,
        all_staff_records,
        customer_credentials,
        pickup_requests,
        racks,
        route_calendar,
        pos_price_discount_override,
        order_payment_collect,
        financial_reports,
      } = req.body;

      orders = normalizePermValue(orders);
      Pay_Out = normalizePermValue(Pay_Out);
      branch_n_store = normalizePermValue(branch_n_store);
      master_setting = normalizePermValue(master_setting);
      customers = normalizePermValue(customers);
      expense = normalizePermValue(expense);
      service = normalizePermValue(service);
      reports = normalizePermValue(reports);
      tools = normalizePermValue(tools);
      mail = normalizePermValue(mail);
      master = normalizePermValue(master);
      sms = normalizePermValue(sms);
      staff = normalizePermValue(staff);
      pos = normalizePermValue(pos);
      rollname = normalizePermValue(rollname);
      couponname = normalizePermValue(couponname);
      accountname = normalizePermValue(accountname);
      notification_setting = normalizePermValue(notification_setting);
      notification_templates = normalizePermValue(notification_templates);
      store_setting = normalizePermValue(store_setting);
      printer_setting = normalizePermValue(printer_setting);
      all_staff_records = normalizePermValue(all_staff_records);
      customer_credentials = normalizePermValue(customer_credentials);
      pickup_requests = normalizePermValue(pickup_requests);
      racks = normalizePermValue(racks);
      route_calendar = normalizePermValue(route_calendar);
      pos_price_discount_override = normalizePermValue(pos_price_discount_override);
      order_payment_collect = normalizePermValue(order_payment_collect);
      financial_reports = normalizePermValue(financial_reports);
      if (store_setting && !master) {
        master = store_setting;
      } else if (master && !store_setting) {
        store_setting = master;
      }

      const rollTypeClause = rollType ? `rollType='${String(rollType).replace(/'/g, "\\'")}',` : "";
      const newroll = await DataUpdate(
        "tbl_roll",
        `roll='${String(name_update || "").replace(/'/g, "\\'")}',
   orders='${orders}',
   expense='${expense}',
   customers='${customers}',
   service='${service}',
   master_setting='${master_setting}',
   reports='${reports}',
   tools='${tools}',
   mail='${mail}',
   master='${master}',
   sms='${sms}',
   staff='${staff}',
   pos='${pos}',
   Pay_Out='${Pay_Out}',
   ${rollTypeClause}
   rollaccess='${rollname}',
   account='${accountname}',
   coupon='${couponname}',
   branch_n_store='${branch_n_store}',
    notification_setting='${notification_setting}',
    notification_templates='${notification_templates}',
    store_setting='${store_setting}',
    printer_setting='${printer_setting}',
     all_staff_records='${all_staff_records}',
     customer_credentials='${customer_credentials}',
     pickup_requests='${pickup_requests}',
     racks='${racks}',
     route_calendar='${route_calendar}',
     pos_price_discount_override='${pos_price_discount_override}',
     order_payment_collect='${order_payment_collect}',
     financial_reports='${financial_reports}'`,
        `id=${rollid}`,
        req.hostname,
        req.protocol,
      );

      if (newroll === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Roll Updated!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/storesetting", auth, async (req, res) => {
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

    let targetStoreId = store;
    if (!targetStoreId || targetStoreId === " " || targetStoreId === "") {
      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
      );
      if (adminData.length > 0 && adminData[0].store_ID) {
        targetStoreId = adminData[0].store_ID;
      }
    }

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasReadPermission =
      (isMaster && accessdata.mutibranch === false) ||
      (accessdata.roll?.store_setting?.includes("read")) ||
      (rolldetail.length > 0 && rolldetail[0].store_setting && rolldetail[0].store_setting.includes("read")) ||
      (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("read"));

    if (!hasReadPermission && !isMaster) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    let storedata = [];
    let update = false;

    if (targetStoreId && targetStoreId !== " " && targetStoreId != 0) {
      storedata = await DataFind(`
        SELECT
        tbl_store.*,
        tbl_customer.name AS customer_name
        FROM tbl_store
        LEFT JOIN tbl_customer ON tbl_customer.store_id = tbl_store.id AND tbl_customer.approved = 1 AND tbl_customer.delet_flage = 0 AND (tbl_customer.username IS NULL OR tbl_customer.username = '' OR tbl_customer.name LIKE '%Walk%in%')
        WHERE tbl_store.id = ${targetStoreId} AND tbl_store.status = 1 LIMIT 1
      `);

      const hasEditPermission =
        isMaster ||
        (accessdata.roll?.store_setting?.includes("edit")) ||
        (rolldetail.length > 0 && rolldetail[0].store_setting && rolldetail[0].store_setting.includes("edit")) ||
        (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("edit"));
      update =
        (rolldetail.length > 0 &&
          rolldetail[0].rollType === "master" &&
          accessdata.mutibranch === false) ||
        hasEditPermission;
    } else if (rolldetail.length > 0 && rolldetail[0].rollType === "master") {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        req.flash("error", "You Can Access This Data From Store List");
        return res.redirect(req.get("Referrer") || "/");
      } else {
        var storeID = await DataFind(
          `SELECT * FROM tbl_admin WHERE  id= ${id}`,
        );

        storedata = await DataFind(
          "SELECT * FROM tbl_store WHERE id=" + storeID[0].store_ID + " ",
        );
        update = true;
        console.log("storedata1", storedata);
      }
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    let paymentAccounts = [];
    if (storedata && storedata.length > 0 && storedata[0].id) {
      paymentAccounts = await DataFind(`SELECT id, ac_name FROM tbl_account WHERE store_ID = ${storedata[0].id} AND delet_flage != '1'`);
    }

    res.render("storeSetting", {
      storedata,
      update,
      accessdata,
      paymentAccounts,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {}
});

// branch update by store admin
router.post(
  "/updatesetting/:id",
  auth,
  upload.single("logo"),
  async (req, res) => {
    try {
      if (process.env.DISABLE_DB_WRITE === "true") {
        req.flash("error", "For demo purpose we disabled crud operations!!");
        return res.redirect(req.get("Referrer") || "/");
      }

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

      let userStore = store;
      if (!userStore || userStore === " " || userStore === "") {
        const adminData = await DataFind(
          `SELECT store_ID FROM tbl_admin WHERE id = ${id}`,
        );

        if (adminData.length > 0) userStore = adminData[0].store_ID;
      }

      const isMaster =
        rolldetail.length > 0 && rolldetail[0].rollType === "master";
      const hasEdit =
        isMaster ||
        (accessdata.roll?.store_setting?.includes("edit")) ||
        (rolldetail.length > 0 && rolldetail[0].store_setting && rolldetail[0].store_setting.includes("edit")) ||
        (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("edit"));
      const isStoreAuthorized =
        isMaster || (userStore == req.params.id && hasEdit);

      if (isStoreAuthorized) {
        const dataid = req.params.id;
        if (req.file) {
          const logo = req.file.filename;
          // const logoupdate = await DataFind(
          //   `UPDATE tbl_store SET logo='${logo}' WHERE id=${dataid}`
          // );

          const logoUpdate = await DataUpdate(
            "tbl_store",
            `logo='${logo}'`,
            `id=${dataid}`,
            req.hostname,
            req.protocol,
          );

          if (logoUpdate === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }

        const {
          name,
          adminid,
          number,
          store_email,
          state,
          city,
          tax_number,
          username,
          password,
          commission,
          taxpercent,
          country,
          district,
          zip_code,
          address,
          walkincustome,
          contact_first_name,
          contact_last_name,
          contact_phone,
          contact_email,
        } = req.body;

        const OldDadta = await DataFind(
          `SELECT * FROM tbl_store WHERE id=${dataid}`,
        );
        let haspass = "";

        if (password.length > 0) {
          const salt = bcrypt.genSaltSync(10);
          haspass = bcrypt.hashSync(password, salt);
        } else {
          haspass = OldDadta[0].password;
        }

        // const dataupdate =
        //   await DataFind(`UPDATE tbl_store SET name='${name}', mobile_number='${number}', username='${username}', password='${haspass}', shop_commission=${commission},tax_percent=${taxpercent},country='${country}',state='${state}',
        //      city='${city}',district='${district}',zipcode='${zip_code}',store_email='${store_email}',store_tax_number='${tax_number}',address='${address}'
        //     WHERE id=${dataid}`);

        const hasOverride = req.body.override_ready_schedule == "1" || req.body.override_ready_schedule === "on" || req.body.override_ready_schedule === 1;
        let leadDaysSQL = "NULL";
        let cutoffSQL = "NULL";
        let readyTimeSQL = "NULL";
        let wDaysSQL = "NULL";

        if (hasOverride) {
          let leadDays = parseInt(req.body.ready_lead_days);
          leadDaysSQL = (!isNaN(leadDays) && leadDays >= 0) ? leadDays : 2;
          cutoffSQL = `'${(req.body.ready_cutoff_time || "13:00").trim().replace(/'/g, "\\'")}'`;
          readyTimeSQL = `'${(req.body.ready_time || "16:00").trim().replace(/'/g, "\\'")}'`;
          let wDays = req.body.ready_working_days;
          let workingDaysStr = Array.isArray(wDays) ? wDays.join(",") : (wDays ? String(wDays).trim() : "1,2,3,4,5,6");
          wDaysSQL = `'${workingDaysStr.replace(/'/g, "\\'")}'`;
        }

        const onesignalAppId = (req.body.onesignal_app_id || "").trim().replace(/'/g, "\\'");
        const onesignalApiKey = (req.body.onesignal_api_key || "").trim().replace(/'/g, "\\'");
        const twilioSid = (req.body.twilio_sid || "").trim().replace(/'/g, "\\'");
        const twilioAuthToken = (req.body.twilio_auth_token || "").trim().replace(/'/g, "\\'");
        const twilioPhoneNo = (req.body.twilio_phone_no || "").trim().replace(/'/g, "\\'");

        const defaultCustomerEnabled = (req.body.default_customer_enabled == "1" || req.body.default_customer_enabled === "on" || req.body.default_customer_enabled === 1) ? 1 : 0;

        const safeContactFName = (contact_first_name || "").trim().replace(/'/g, "\\'");
        const safeContactLName = (contact_last_name || "").trim().replace(/'/g, "\\'");
        const safeContactPhone = (contact_phone || "").trim().replace(/'/g, "\\'");
        const safeContactEmail = (contact_email || "").trim().replace(/'/g, "\\'");
        const safeDistrict = (district || "").trim().replace(/'/g, "\\'");
        const safeOrderPrefix = (req.body.order_prefix || "A").trim().toUpperCase().slice(0, 4).replace(/'/g, "\\'") || "A";

        const rawOverrideRate1 = parseFloat(req.body.override_rate_percent);
        const safeOverrideRate1 = (!isNaN(rawOverrideRate1) && rawOverrideRate1 >= 0) ? rawOverrideRate1 : 10;
        const defaultPaymentType = req.body.default_payment_type ? req.body.default_payment_type.trim().replace(/'/g, "\\'") : 'Cash';

        const storeUpdate = await DataUpdate(
          "tbl_store",
          `name='${name}', default_payment_type='${defaultPaymentType}', order_prefix='${safeOrderPrefix}', mobile_number='${number}', username='${username}', password='${haspass}', shop_commission=${commission}, tax_percent=${taxpercent}, override_rate_percent=${safeOverrideRate1}, country='${country}', state='${state}', city='${city}', district='${safeDistrict}', zipcode='${zip_code}', store_email='${store_email}', store_tax_number='${tax_number}', address='${address}', ready_lead_days=${leadDaysSQL}, ready_cutoff_time=${cutoffSQL}, ready_time=${readyTimeSQL}, ready_working_days=${wDaysSQL}, onesignal_app_id='${onesignalAppId}', onesignal_api_key='${onesignalApiKey}', twilio_sid='${twilioSid}', twilio_auth_token='${twilioAuthToken}', twilio_phone_no='${twilioPhoneNo}', default_customer_enabled=${defaultCustomerEnabled}, contact_first_name='${safeContactFName}', contact_last_name='${safeContactLName}', contact_phone='${safeContactPhone}', contact_email='${safeContactEmail}'`,
          `id=${dataid}`,
          req.hostname,
          req.protocol,
        );

        if (storeUpdate === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        if (defaultCustomerEnabled === 1 && walkincustome && walkincustome.trim().length > 0) {
          const safeWalkInName = walkincustome.trim().replace(/'/g, "\\'");
          const existingWalkIn = await DataFind(
            `SELECT id FROM tbl_customer WHERE store_ID = '${dataid}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`
          );
          if (existingWalkIn.length > 0) {
            await DataUpdate(
              "tbl_customer",
              `name='${safeWalkInName}'`,
              `id=${existingWalkIn[0].id}`,
              req.hostname,
              req.protocol,
            );
          } else {
            await DataInsert(
              "tbl_customer",
              `name, store_ID, reffstore, approved, delet_flage`,
              `'${safeWalkInName}', '${dataid}', '${dataid}', 1, 0`,
              req.hostname,
              req.protocol,
            );
          }
        }

        // const adminUpdate = await DataUpdate(
        //   "tbl_admin",
        //   `name='${name}', number='${number}', username='${username}', password='${haspass}', email='${store_email}'`,
        //   `id=${adminid}`,
        //   req.hostname,
        //   req.protocol,
        // );

        // if (adminUpdate === -1) {
        //   req.flash("error", "Action failed, please check input and try again");
        //   return res.redirect("back");
        // }

        req.flash("success", "Store Details Updated!");
        res.redirect("back");
      } else {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }
    } catch (error) {
      console.log(error);
    }
  },
);

// <<<< Branch shope list master only>>>>>>>
router.get("/storelist", auth, async (req, res) => {
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

    if (rolldetail[0].rollType === "master") {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        res.render("storelist", {
          storeList: [],
          accessdata,
          language: req.language_data,
          language_name: req.language_name,
        });
      } else {
        req.flash("error", "Branch Store Note Availabal");
        return res.redirect(req.get("Referrer") || "/");
      }
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {}
});

router.get("/storelist/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "1" ? "1" : "0";
      filterConditions.push(`tbl_store.status = '${cleanStatus}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_store.*`,
      from: `tbl_store`,
      searchColumns: [
        "tbl_store.name",
        "tbl_store.id",
        "tbl_store.mobile_number",
        "tbl_store.store_email",
        "tbl_store.address",
        "tbl_store.contact_first_name",
        "tbl_store.contact_last_name",
        "tbl_store.contact_phone",
      ],
      baseWhere: ["tbl_store.delete_flage = 0"],
      filterWhere: filterConditions,
      defaultOrder: "tbl_store.id DESC",
      columnMap: {
        0: "tbl_store.id",
        1: "tbl_store.name",
        2: "tbl_store.contact_last_name",
        3: "tbl_store.id",
        4: "tbl_store.status",
      },
      postProcess: async (rows) => {
        return rows.map((s) => ({
          id: s.id,
          name: s.name || "",
          status: parseInt(s.status) || 0,
          contact_first_name: s.contact_first_name || "",
          contact_last_name: s.contact_last_name || "",
          contact_phone: s.contact_phone || "",
          contact_email: s.contact_email || "",
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Storelist data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

// Delete store and cascade delete all related store data (master only)
router.get("/deletestore/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/tool/storelist");
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You are not authorized for this action");
      return res.redirect(req.get("Referrer") || "/tool/storelist");
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
      !rolldetail ||
      rolldetail.length === 0 ||
      rolldetail[0].rollType !== "master"
    ) {
      req.flash("error", "You are not authorized for this action");
      return res.redirect(req.get("Referrer") || "/tool/storelist");
    }

    const storeId = parseInt(req.params.id);
    if (!storeId || isNaN(storeId)) {
      req.flash("error", "Invalid Store ID");
      return res.redirect("/tool/storelist");
    }

    const existingStore = await DataFind(
      `SELECT * FROM tbl_store WHERE id = ${storeId}`,
    );
    if (!existingStore || existingStore.length === 0) {
      req.flash("error", "Store not found or already deleted");
      return res.redirect("/tool/storelist");
    }

    // 1. Find all orders belonging to this store
    const storeOrders = await DataFind(
      `SELECT id, service_list FROM tbl_order WHERE store_id = '${storeId}' OR transferred_from_store_id = '${storeId}'`,
    );
    if (storeOrders && storeOrders.length > 0) {
      const orderIds = storeOrders.map((o) => `'${o.id}'`).join(",");

      // Delete payments for these orders
      await DataDelete(
        "tbl_order_payment",
        `order_id IN (${orderIds})`,
        req.hostname,
        req.protocol,
      );

      // Collect service list item IDs from orders
      let cartServiceIds = [];
      storeOrders.forEach((o) => {
        if (o.service_list && typeof o.service_list === "string") {
          o.service_list.split(",").forEach((sid) => {
            const trimmed = sid.trim();
            if (trimmed && !isNaN(trimmed)) {
              cartServiceIds.push(trimmed);
            }
          });
        }
      });

      if (cartServiceIds.length > 0) {
        const uniqueCartServiceIds = [...new Set(cartServiceIds)]
          .map((id) => `'${id}'`)
          .join(",");
        await DataDelete(
          "tbl_cart_servicelist",
          `id IN (${uniqueCartServiceIds})`,
          req.hostname,
          req.protocol,
        );
      }

      // Delete orders
      await DataDelete(
        "tbl_order",
        `store_id = '${storeId}' OR transferred_from_store_id = '${storeId}'`,
        req.hostname,
        req.protocol,
      );
    }

    // 2. Find carts belonging to this store
    const storeCarts = await DataFind(
      `SELECT id, service_list_id FROM tbl_cart WHERE store_id = '${storeId}'`,
    );
    if (storeCarts && storeCarts.length > 0) {
      let cartServiceListIds = [];
      storeCarts.forEach((c) => {
        if (c.service_list_id && typeof c.service_list_id === "string") {
          c.service_list_id.split(",").forEach((sid) => {
            const trimmed = sid.trim();
            if (trimmed && !isNaN(trimmed)) {
              cartServiceListIds.push(trimmed);
            }
          });
        }
      });
      if (cartServiceListIds.length > 0) {
        const uniqueCartServiceListIds = [...new Set(cartServiceListIds)]
          .map((id) => `'${id}'`)
          .join(",");
        await DataDelete(
          "tbl_cart_servicelist",
          `id IN (${uniqueCartServiceListIds})`,
          req.hostname,
          req.protocol,
        );
      }
      await DataDelete(
        "tbl_cart",
        `store_id = '${storeId}'`,
        req.hostname,
        req.protocol,
      );
    }

    // 3. Delete services and service types for this store
    await DataDelete(
      "tbl_services",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_services_type",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 4. Delete addons and coupons
    await DataDelete(
      "tbl_addons",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_coupon",
      `store_list_id = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 5. Delete expenses and expense categories
    await DataDelete(
      "tbl_expense",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_exp_cat_type",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_exp_cat",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 6. Delete transactions, accounts, commissions, emails
    await DataDelete(
      "tbl_transections",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_account",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_commision",
      `store_id = '${storeId}'`,
      req.hostname,
      req.protocol,
    );
    await DataDelete(
      "tbl_email",
      `store_id = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 7. Delete customers associated with this store
    await DataDelete(
      "tbl_customer",
      `store_ID = '${storeId}' OR reffstore = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 8. Delete admin/staff users assigned to this store
    await DataDelete(
      "tbl_admin",
      `store_ID = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    // 9. Delete the store record itself
    await DataDelete(
      "tbl_store",
      `id = '${storeId}'`,
      req.hostname,
      req.protocol,
    );

    req.flash("success", "Store and all related data deleted successfully");
    return res.redirect("/tool/storelist");
  } catch (error) {
    console.error("Delete store error:", error);
    req.flash("error", "Error deleting store: " + error.message);
    return res.redirect("/tool/storelist");
  }
});

//  branch store data render page master only
router.get("/approvedshop/:id", auth, async (req, res) => {
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
    if (rolldetail[0].rollType === "master") {
      var storedata = await DataFind(
        `SELECT tbl_store.*, tbl_customer.name AS customer_name
         FROM tbl_store
         LEFT JOIN tbl_customer ON tbl_customer.store_ID = tbl_store.id AND tbl_customer.approved = 1 AND tbl_customer.delet_flage = 0 AND (tbl_customer.username IS NULL OR tbl_customer.username = '' OR tbl_customer.name LIKE '%Walk%in%')
         WHERE tbl_store.id = ${req.params.id} LIMIT 1`,
      );

      console.log("storedata", storedata);

      const rolldata = await DataFind(
        "select * from tbl_roll where delet_flage = 0 ",
      );
      console.log("rolldata", rolldata);

      let paymentAccounts = [];
      if (storedata && storedata.length > 0 && storedata[0].id) {
        paymentAccounts = await DataFind(`SELECT id, ac_name FROM tbl_account WHERE store_ID = ${storedata[0].id} AND delet_flage != '1'`);
      }

      res.render("store_settings_bymaster", {
        rolldata,
        storedata,
        accessdata,
        paymentAccounts,
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

// branch store setting data master only
router.post(
  "/branchdata/:id",
  auth,
  upload.single("logo"),
  async (req, res) => {
    try {
      if (process.env.DISABLE_DB_WRITE === "true") {
        req.flash("error", "For demo purpose we disabled crud operations!!");
        return res.redirect(req.get("Referrer") || "/");
      }
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
      if (rolldetail[0].rollType === "master") {
        var dataid = req.params.id;

        const {
          name,
          number,
          store_email,
          state,
          city,
          tax_number,
          username,
          password,
          commission,
          taxpercent,
          country,
          district,
          zip_code,
          address,
          status,
          roll,
          walkincustome,
          contact_first_name,
          contact_last_name,
          contact_phone,
          contact_email,
        } = req.body;

        console.log("req.body", req.body);

        console.log(req.file);
        let storefind = await DataFind(
          `SELECT * FROM tbl_store WHERE id=${dataid}`,
        );
        let imgFiled = storefind[0].logo;
        if (req.file) {
          imgFiled = req.file.filename;
        }

        let OldData = await DataFind(
          `SELECT * FROM tbl_store   WHERE id=${dataid}`,
        );
        let haspass = "";
        if (password.length > 0) {
          const salt = bcrypt.genSaltSync(10);
          haspass = bcrypt.hashSync(password, salt);
        } else {
          haspass = OldData[0].password;
        }
        // const dataupdate =
        //   await DataFind(`UPDATE tbl_store SET name='${name}',mobile_number='${number}',username='${username}',
        //    password='${haspass}',shop_commission=${commission},tax_percent=${taxpercent},country='${country}',state='${state}',
        //    city='${city}',district='${district}',zipcode='${zip_code}',store_email='${store_email}',store_tax_number='${tax_number}',
        //    address='${address}', status=${status}, roll_ID=${roll},logo='${imgFiled}' WHERE id=${dataid}`);

        const hasOverride = req.body.override_ready_schedule == "1" || req.body.override_ready_schedule === "on" || req.body.override_ready_schedule === 1;
        let leadDaysSQL = "NULL";
        let cutoffSQL = "NULL";
        let readyTimeSQL = "NULL";
        let wDaysSQL = "NULL";

        if (hasOverride) {
          let leadDays = parseInt(req.body.ready_lead_days);
          leadDaysSQL = (!isNaN(leadDays) && leadDays >= 0) ? leadDays : 2;
          cutoffSQL = `'${(req.body.ready_cutoff_time || "13:00").trim().replace(/'/g, "\\'")}'`;
          readyTimeSQL = `'${(req.body.ready_time || "16:00").trim().replace(/'/g, "\\'")}'`;
          let wDays = req.body.ready_working_days;
          let workingDaysStr = Array.isArray(wDays) ? wDays.join(",") : (wDays ? String(wDays).trim() : "1,2,3,4,5,6");
          wDaysSQL = `'${workingDaysStr.replace(/'/g, "\\'")}'`;
        }

        const onesignalAppId = (req.body.onesignal_app_id || "").trim().replace(/'/g, "\\'");
        const onesignalApiKey = (req.body.onesignal_api_key || "").trim().replace(/'/g, "\\'");
        const twilioSid = (req.body.twilio_sid || "").trim().replace(/'/g, "\\'");
        const twilioAuthToken = (req.body.twilio_auth_token || "").trim().replace(/'/g, "\\'");
        const twilioPhoneNo = (req.body.twilio_phone_no || "").trim().replace(/'/g, "\\'");

        const defaultCustomerEnabled = (req.body.default_customer_enabled == "1" || req.body.default_customer_enabled === "on" || req.body.default_customer_enabled === 1) ? 1 : 0;

        const safeContactFName = (contact_first_name || "").trim().replace(/'/g, "\\'");
        const safeContactLName = (contact_last_name || "").trim().replace(/'/g, "\\'");
        const safeContactPhone = (contact_phone || "").trim().replace(/'/g, "\\'");
        const safeContactEmail = (contact_email || "").trim().replace(/'/g, "\\'");
        const safeDistrict = (district || "").trim().replace(/'/g, "\\'");
        const safeOrderPrefix = (req.body.order_prefix || "A").trim().toUpperCase().slice(0, 4).replace(/'/g, "\\'") || "A";

        const rawOverrideRate2 = parseFloat(req.body.override_rate_percent);
        const safeOverrideRate2 = (!isNaN(rawOverrideRate2) && rawOverrideRate2 >= 0) ? rawOverrideRate2 : 10;
        const defaultPaymentType = req.body.default_payment_type ? req.body.default_payment_type.trim().replace(/'/g, "\\'") : 'Cash';

        const storeUpdate = await DataUpdate(
          "tbl_store",
          `name='${name}', default_payment_type='${defaultPaymentType}', order_prefix='${safeOrderPrefix}', mobile_number='${number}', username='${username}', password='${haspass}', shop_commission=${commission}, tax_percent=${taxpercent}, override_rate_percent=${safeOverrideRate2}, country='${country}', state='${state}', city='${city}', district='${safeDistrict}', zipcode='${zip_code}', store_email='${store_email}', store_tax_number='${tax_number}', address='${address}', status=${status}, roll_ID=${roll}, logo='${imgFiled}', ready_lead_days=${leadDaysSQL}, ready_cutoff_time=${cutoffSQL}, ready_time=${readyTimeSQL}, ready_working_days=${wDaysSQL}, onesignal_app_id='${onesignalAppId}', onesignal_api_key='${onesignalApiKey}', twilio_sid='${twilioSid}', twilio_auth_token='${twilioAuthToken}', twilio_phone_no='${twilioPhoneNo}', default_customer_enabled=${defaultCustomerEnabled}, contact_first_name='${safeContactFName}', contact_last_name='${safeContactLName}', contact_phone='${safeContactPhone}', contact_email='${safeContactEmail}'`,
          `id=${dataid}`,
          req.hostname,
          req.protocol,
        );
        if (storeUpdate === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        if (defaultCustomerEnabled === 1 && walkincustome && walkincustome.trim().length > 0) {
          const safeWalkInName = walkincustome.trim().replace(/'/g, "\\'");
          const existingWalkIn = await DataFind(
            `SELECT id FROM tbl_customer WHERE store_ID = '${dataid}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`
          );
          if (existingWalkIn.length > 0) {
            await DataUpdate(
              "tbl_customer",
              `name='${safeWalkInName}'`,
              `id=${existingWalkIn[0].id}`,
              req.hostname,
              req.protocol,
            );
          } else {
            await DataInsert(
              "tbl_customer",
              `name, store_ID, reffstore, approved, delet_flage`,
              `'${safeWalkInName}', '${dataid}', '${dataid}', 1, 0`,
              req.hostname,
              req.protocol,
            );
          }
        }

        const adminid = await DataFind(
          "SELECT admin_id FROM tbl_store WHERE id=" + dataid + "",
        );

        // const adminupdate =
        //   await DataFind(`UPDATE tbl_admin SET name='${name}',number='${number}',
        //    username='${username}',password='${haspass}',email='${store_email}' WHERE id=${adminid[0].admin_id}`);

        const adminUpdate = await DataUpdate(
          "tbl_admin",
          `name='${name}', number='${number}', username='${username}', password='${haspass}', email='${store_email}'`,
          `id=${adminid[0].admin_id}`,
          req.hostname,
          req.protocol,
        );

        if (adminUpdate === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        if (status == 1) {
          // const admndata = await DataFind(
          //   "UPDATE tbl_admin SET store_ID=" +
          //     dataid +
          //     " ,roll_id=" +
          //     roll +
          //     ",approved= 1 WHERE id=" +
          //     adminid[0].admin_id +
          //     ""
          // );

          let finalRollId = roll;
          const existingStaffRoll = await DataFind(
            `SELECT id FROM tbl_staff_roll WHERE staff_id = '${adminid[0].admin_id}'`,
          );
          if (existingStaffRoll.length > 0) {
            finalRollId = existingStaffRoll[0].id;
          } else {
            const RollFind = await DataFind(
              `SELECT * FROM tbl_roll WHERE id='${roll}'`,
            );
            if (RollFind.length > 0) {
              const rc = buildRoleCopyFields(RollFind[0], {
                customers: "read,write,edit,delete",
                orders: "read,write,edit,delete",
                expense: "read,write,edit,delete",
                service: "read,write,edit,delete",
                reports: "read",
                tools: "read",
                mail: "read,edit",
                master: "read,edit",
                sms: "read,write,edit,delete",
                staff: "read,write,edit,delete",
                pos: "read,write,edit",
                account: "read,write,edit,delete",
                coupon: "read,write,edit,delete",
                customer_credentials: "edit",
                pickup_requests: "read,edit",
                racks: "read,write,edit,delete",
                route_calendar: "read,edit",
                pos_price_discount_override: "edit",
                order_payment_collect: "write",
                financial_reports: "read",
              });
              const RollAdd = await DataInsert(
                `tbl_staff_roll`,
                `customers, orders, expense, service, reports, tools, mail, master, sms, staff, pos, rollaccess, account, coupon, branch_n_store, master_setting, Pay_Out, notification_setting, notification_templates, store_setting, printer_setting, all_staff_records, customer_credentials, pickup_requests, racks, route_calendar, pos_price_discount_override, order_payment_collect, financial_reports, main_roll_id, staff_id, is_staff`,
                `'${rc.customers}', '${rc.orders}', '${rc.expense}', '${rc.service}', '${rc.reports}', '${rc.tools}', '${rc.mail}', '${rc.master}', '${rc.sms}', '${rc.staff}', '${rc.pos}', '', '${rc.account}', '${rc.coupon}', '', '', '', '${rc.notification_setting}', '${rc.notification_templates}', '${rc.store_setting}', '${rc.printer_setting}', '${rc.all_staff_records}', '${rc.customer_credentials}', '${rc.pickup_requests}', '${rc.racks}', '${rc.route_calendar}', '${rc.pos_price_discount_override}', '${rc.order_payment_collect}', '${rc.financial_reports}', '${RollFind[0].id}', '${adminid[0].admin_id}', '0'`,
                req.hostname,
                req.protocol,
              );
              if (RollAdd && RollAdd != -1) {
                finalRollId = RollAdd.insertId;
              }
            }
          }

          const adminDataUpdate1 = await DataUpdate(
            "tbl_admin",
            `store_ID=${dataid}, roll_id=${finalRollId}, approved=1`,
            `id=${adminid[0].admin_id}`,
            req.hostname,
            req.protocol,
          );

          if (adminDataUpdate1 === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        } else if (status == 2) {
          // const admndata = await DataFind(
          //   "UPDATE tbl_admin SET store_ID=" +
          //     dataid +
          //     " , approved= 2 WHERE id=" +
          //     adminid[0].admin_id +
          //     " OR store_ID=" +
          //     dataid +
          //     " "
          // );

          const adminDataUpdate2 = await DataUpdate(
            "tbl_admin",
            `store_ID=${dataid}, approved=2`,
            `id=${adminid[0].admin_id} OR store_ID=${dataid}`,
            req.hostname,
            req.protocol,
          );

          if (adminDataUpdate2 === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }

        req.flash("success", "Store Details Updated!");
        res.redirect("/tool/storelist");
      } else {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }
    } catch (error) {
      console.log(error);
    }
  },
);

//add new shope by admin get master only
router.get("/addshop", auth, async (req, res) => {
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
    if (rolldetail[0].branch_n_store.includes("write")) {
      const rolldata = await DataFind(
        "select * from tbl_roll where delet_flage =0 ",
      );
      res.render("shop_add_admin", {
        rolldata,
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

// add new shop by admin post router master only
router.post("/shopregister", auth, upload.single("logo"), async (req, res) => {
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
    if (rolldetail[0].branch_n_store.includes("write")) {
      const {
        name,
        number,
        store_email,
        state,
        city,
        tax_number,
        username,
        password,
        commission,
        taxpercent,
        country,
        district,
        zip_code,
        address,
        roll: rollid,
        status,
        walkincustome,
        contact_first_name,
        contact_last_name,
        contact_phone,
        contact_email,
      } = req.body;

      const checkname = await DataFind(
        "SELECT * FROM tbl_store WHERE name='" + name + "'",
      );
      if (checkname.length > 0) {
        req.flash("error", "This Store Name Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }

      const checknumber = await DataFind(
        "SELECT * FROM tbl_store WHERE mobile_number='" + number + "'",
      );
      if (checknumber.length > 0) {
        req.flash("error", "This Number Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }

      const checkusername = await DataFind(
        "SELECT * FROM tbl_store WHERE username='" + username + "'",
      );
      if (checkusername.length > 0) {
        req.flash("error", "This Username Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }

      const checkstore_email = await DataFind(
        "SELECT * FROM tbl_store WHERE store_email='" + store_email + "'",
      );
      if (checkstore_email.length > 0) {
        req.flash("error", "This Email Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }

      var logo = req.file.filename;
      const salt = bcrypt.genSaltSync(10);
      const hashpass = bcrypt.hashSync(password, salt);

      // const admindata = await DataFind(
      //   "INSERT INTO tbl_admin (name,number,email,username,password,img) VALUE ('" +
      //     name +
      //     "','" +
      //     number +
      //     "','" +
      //     store_email +
      //     "','" +
      //     username +
      //     "','" +
      //     hashpass +
      //     "','" +
      //     logo +
      //     "')"
      // );

      const admindata = await DataInsert(
        `tbl_admin`,
        `name,number,email,username,password,img`,
        `'${name}','${number}','${store_email}','${username}','${hashpass}','${logo}'`,
        req.hostname,
        req.protocol,
      );

      if (admindata == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      var newid = admindata.insertId;

      // const qury = `INSERT INTO tbl_store (name,logo,mobile_number,username,password,shop_commission,tax_percent,country,state,city,district,zipcode,store_email,store_tax_number,address,admin_id,status,roll_ID)
      //                   VALUE ('${name}','${logo}','${number}','${username}','${hashpass}',${commission},${taxpercent},'${country} ','${state}','${city}',' ${district}','${zip_code}','${store_email}',
      //                   '${tax_number}','${address} ',${newid},${status},${rollid})`;

      // const newstore = await DataFind(qury);

      const safeContactFName = (contact_first_name || "").trim().replace(/'/g, "\\'");
      const safeContactLName = (contact_last_name || "").trim().replace(/'/g, "\\'");
      const safeContactPhone = (contact_phone || "").trim().replace(/'/g, "\\'");
      const safeContactEmail = (contact_email || "").trim().replace(/'/g, "\\'");
      const safeDistrict = (district || "").trim().replace(/'/g, "\\'");

      let safeOrderPrefix = (req.body.order_prefix || "").trim().toUpperCase().slice(0, 4).replace(/'/g, "\\'");
      if (!safeOrderPrefix) {
        const storePrefixes = await DataFind("SELECT order_prefix FROM tbl_store WHERE order_prefix IS NOT NULL AND order_prefix != ''");
        const used = new Set(storePrefixes.map(p => p.order_prefix.toUpperCase()));
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let ch of letters) {
          if (!used.has(ch)) {
            safeOrderPrefix = ch;
            break;
          }
        }
        if (!safeOrderPrefix) safeOrderPrefix = (name && name.charAt(0).toUpperCase()) || "A";
      }

      const rawOverrideRate3 = parseFloat(req.body.override_rate_percent);
      const safeOverrideRate3 = (!isNaN(rawOverrideRate3) && rawOverrideRate3 >= 0) ? rawOverrideRate3 : 10;

      const newstore = await DataInsert(
        `tbl_store`,
        `name,order_prefix,logo,mobile_number,username,password,shop_commission,tax_percent,override_rate_percent,country,state,city,district,zipcode,store_email,store_tax_number,address,admin_id,status,roll_ID,contact_first_name,contact_last_name,contact_phone,contact_email`,
        `'${name}','${safeOrderPrefix}','${logo}','${number}','${username}','${hashpass}',${commission},${taxpercent},${safeOverrideRate3},'${country} ','${state}','${city}','${safeDistrict}','${zip_code}','${store_email}',
        '${tax_number}','${address} ',${newid},${status},${rollid},'${safeContactFName}','${safeContactLName}','${safeContactPhone}','${safeContactEmail}'`,
        req.hostname,
        req.protocol,
      );

      if (newstore == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      const RollFind = await DataFind(
        `SELECT * FROM tbl_roll WHERE id='${rollid}'`,
      );

      const rcShop = buildRoleCopyFields(RollFind[0], {
        customers: "read,write,edit,delete",
        coupon: "read,write,edit,delete",
        customer_credentials: "edit",
        pickup_requests: "read,edit",
        racks: "read,write,edit,delete",
        route_calendar: "read,edit",
        pos_price_discount_override: "edit",
        order_payment_collect: "write",
        financial_reports: "read",
      });

      const RollAdd = await DataInsert(
        `tbl_staff_roll`,
        `customers, orders, expense, service, reports, tools, mail,master, sms, staff, pos, rollaccess, account, coupon,
                                         branch_n_store, master_setting, Pay_Out, notification_setting, notification_templates, store_setting, printer_setting, all_staff_records, customer_credentials, pickup_requests, racks, route_calendar, pos_price_discount_override, order_payment_collect, financial_reports, main_roll_id, staff_id,is_staff`,
        `'${rcShop.customers}', '${rcShop.orders}', '${rcShop.expense}', '${rcShop.service}', '${rcShop.reports}', '${rcShop.tools}', '${rcShop.mail}','${rcShop.master}', '${rcShop.sms}', '${rcShop.staff}', '${rcShop.pos}', '${rcShop.rollaccess}', '${rcShop.account}', '${rcShop.coupon}','${rcShop.branch_n_store}', '${rcShop.master_setting}', '${rcShop.Pay_Out}','${rcShop.notification_setting}','${rcShop.notification_templates}','${rcShop.store_setting}','${rcShop.printer_setting}','${rcShop.all_staff_records}','${rcShop.customer_credentials}','${rcShop.pickup_requests}','${rcShop.racks}','${rcShop.route_calendar}','${rcShop.pos_price_discount_override}','${rcShop.order_payment_collect}','${rcShop.financial_reports}','${RollFind[0].id}','${newid}','0'`,
        req.hostname,
        req.protocol,
      );

      if (RollAdd == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      if (status == 1) {
        // const admndata = await DataFind("UPDATE tbl_admin SET store_ID=" +
        //     newstore.insertId +
        //     ",roll_id=" +
        //     RollAdd.insertId +
        //     ",approved= 1 WHERE id=" +
        //     newid +
        //     "");

        const adminUpdate1 = await DataUpdate(
          "tbl_admin",
          `store_ID=${newstore.insertId}, roll_id=${RollAdd.insertId}, approved=1`,
          `id=${newid}`,
          req.hostname,
          req.protocol,
        );

        if (adminUpdate1 === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }
      } else if (status == 2) {
        // const admndata = await DataFind(
        //   "UPDATE tbl_admin SET store_ID=" +
        //     newstore.insertId +
        //     " , approved= 2 WHERE id=" +
        //     newid +
        //     " OR store_ID=" +
        //     newstore.insertId +
        //     " "
        // );

        const adminUpdate2 = await DataUpdate(
          "tbl_admin",
          `store_ID=${newstore.insertId}, approved=2`,
          `id=${newid} OR store_ID=${newstore.insertId}`,
          req.hostname,
          req.protocol,
        );

        if (adminUpdate2 === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }
      }

      // const walkinCustomerInsert = await DataFind(`
      //                                   INSERT INTO tbl_customer (
      //                                     name, number, email, address, taxnumber,
      //                                     username, password, store_ID, reffstore, approved, delet_flage
      //                                   ) VALUES (
      //                                     '${
      //                                       walkincustome.length > 0
      //                                         ? walkincustome
      //                                         : "Walk In Customer"
      //                                     }', NULL, NULL, NULL, NULL,
      //                                     NULL, NULL, ${newstore.insertId}, ${
      //   newstore.insertId
      // }, "1", 0
      //                                   )
      //                                 `
      // );

      const walkinCustomerInsert = await DataInsert(
        `tbl_customer`,
        `name, number, email, address, taxnumber,username, password, store_ID, reffstore, approved, delet_flage`,
        `'${
          walkincustome.length > 0 ? walkincustome : "Walk In Customer"
        }', NULL, NULL, NULL, NULL, NULL, NULL, ${newstore.insertId}, ${
          newstore.insertId
        }, "1", 0`,
        req.hostname,
        req.protocol,
      );

      if (walkinCustomerInsert == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Shop Resiter success fully !!!!");
      res.redirect("/tool/storelist");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

//<<<<<<<<<<<< Staff Router >>>>>>>>>>>>>>>>>
router.get("/staff", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    console.log(accessdata);
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
  WHERE sr.id = ${roll}`);
    console.log(roll);
    console.log(loginas);

    //  console.log(rolldetail);

    let storeList = [];
    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].staff.includes("read")
    ) {
      var ismulty = true;
      storeList = await DataFind(
        "SELECT id, name FROM tbl_store WHERE status = 1 AND delete_flage = 0 ORDER BY name ASC",
      );
      var staffdata = await DataFind(`
        SELECT tbl_admin.*, tbl_store.name as store, tbl_roll.roll, tbl_roll.rollType, tbl_staff_roll.main_roll_id
        FROM tbl_admin
        LEFT JOIN tbl_store ON tbl_admin.store_ID = tbl_store.id
        LEFT JOIN tbl_staff_roll ON tbl_admin.roll_id = tbl_staff_roll.id
        LEFT JOIN tbl_roll ON tbl_staff_roll.main_roll_id = tbl_roll.id
        WHERE tbl_admin.is_staff != '0' AND tbl_admin.delet_flage = 0
        ORDER BY tbl_admin.id DESC
      `);

      var rolldata = await DataFind(
        "SELECT tbl_roll.* FROM tbl_roll WHERE delet_flage=0 AND roll_status ='active'",
      );
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].staff.includes("read")
    ) {
      var ismulty = false;
      storeList = await DataFind(
        `SELECT id, name FROM tbl_store WHERE id = '${store}' AND status = 1 AND delete_flage = 0`,
      );

      var rolldata = await DataFind(
        "SELECT * FROM tbl_roll WHERE delet_flage=0 AND roll_status ='active' AND rollType ='store'",
      );
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    res.render("staff", {
      rolldata,
      staffdata: [],
      storeList,
      ismulty,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/staff/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    let scopeConditions = [
      "tbl_admin.is_staff != '0'",
      "tbl_admin.delet_flage = 0",
    ];

    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      rolldetail[0].staff &&
      rolldetail[0].staff.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "store" &&
      rolldetail[0].staff &&
      rolldetail[0].staff.includes("read")
    ) {
      scopeConditions.push(`tbl_admin.store_ID = '${store}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.approved;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanApproved = String(statusParam).trim() === "1" ? "1" : "0";
      filterConditions.push(`tbl_admin.approved = ${cleanApproved}`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_admin.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.staff &&
      accessdata.roll.staff.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.staff &&
      accessdata.roll.staff.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_admin.*,
               COALESCE(tbl_store.name, 'Not Assigned') as store,
               COALESCE(tbl_roll.roll, '') as roll,
               COALESCE(tbl_roll.rollType, 'store') as rollType,
               tbl_staff_roll.main_roll_id`,
      from: `tbl_admin
             LEFT JOIN tbl_store ON tbl_admin.store_ID = tbl_store.id
             LEFT JOIN tbl_staff_roll ON tbl_admin.roll_id = tbl_staff_roll.id
             LEFT JOIN tbl_roll ON tbl_staff_roll.main_roll_id = tbl_roll.id`,
      searchColumns: [
        "tbl_admin.name",
        "tbl_admin.number",
        "tbl_admin.email",
        "tbl_admin.username",
        "tbl_store.name",
        "tbl_roll.roll",
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_admin.id DESC",
      columnMap: {
        0: "tbl_admin.id",
        1: "tbl_admin.name",
        2: "tbl_admin.number",
        3: "tbl_store.name",
        4: "tbl_admin.approved",
      },
      postProcess: async (rows) => {
        return rows.map((s) => ({
          id: s.id,
          name: s.name || "",
          number: s.number || "",
          email: s.email || "",
          username: s.username || "",
          password: s.password || "",
          store_ID: s.store_ID || "",
          store: s.store || "Not Assigned",
          roll: s.roll || "",
          rollType: s.rollType || "store",
          roll_id: s.roll_id || "",
          main_roll_id: s.main_roll_id || "",
          approved: s.approved === 1 || s.approved === '1' ? 1 : 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Staff list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.get("/deletstaff/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
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

    if (rolldetail[0].staff.includes("delete")) {
      var dataid = req.params.id;

      // const newroll = await DataFind(
      //   "UPDATE tbl_admin SET delet_flage=1, approved=0 WHERE id=" +
      //     dataid +
      //     " "
      // );

      const newroll = await DataUpdate(
        "tbl_admin",
        "delet_flage = 1, approved = 0",
        `id = ${dataid}`,
        req.hostname,
        req.protocol,
      );

      if (newroll === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Staff Deleted  !!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/addstaff", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    let { id, roll, store, loginas } = req.user;
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

    if (rolldetail[0].staff.includes("write")) {
      var {
        name,
        number,
        email,
        username,
        password,
        roll_list,
        active,
        store_id,
      } = req.body;
      active ? (active = 1) : (active = 0);

      const assignedStore =
        store_id !== undefined && store_id !== null && store_id !== ""
          ? store_id
          : store || "";

      let roleTemplateId = roll_list;
      if (!roleTemplateId) {
        const defaultRoll = await DataFind(
          "SELECT id FROM tbl_roll WHERE delet_flage=0 AND roll_status='active' ORDER BY id ASC LIMIT 1",
        );
        roleTemplateId = defaultRoll[0]?.id;
      }

      const RollFind = await DataFind(
        `SELECT * FROM tbl_roll WHERE id = ${roleTemplateId}`,
      );

      const salt = bcrypt.genSaltSync(10);
      const hashpass = bcrypt.hashSync(password, salt);

      const newroll = await DataInsert(
        `tbl_admin`,
        `name,number,email,username,password,store_ID,roll_id,approved,is_staff`,
        `'${name}','${number}','${email}','${username}','${hashpass}','${assignedStore}','${""}',${active},'1'`,
        req.hostname,
        req.protocol,
      );

      if (newroll == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      //   const RollAdd =
      //     await DataFind(`INSERT INTO tbl_staff_roll (customers, orders, expense, service, reports, tools, mail,
      //        master, sms, staff, pos, rollaccess, account, coupon,
      // branch_n_store, master_setting, Pay_Out, main_roll_id, staff_id,is_staff) VALUES ('${RollFind[0].customer}', '${RollFind[0].orders}', '${RollFind[0].expense}', '${RollFind[0].service}', '${RollFind[0].reports}', '${RollFind[0].tools}', '${RollFind[0].mail}',
      // '${RollFind[0].master}', '${RollFind[0].sms}', '${RollFind[0].staff}', '${RollFind[0].pos}', '${RollFind[0].rollaccess}', '${RollFind[0].account}', '${RollFind[0].coupon}',
      // '${RollFind[0].branch_n_store}', '${RollFind[0].master_setting}', '${RollFind[0].Pay_Out}','${RollFind[0].id}','${newroll.insertId}','1')`);

      const rcStaff = buildRoleCopyFields(RollFind[0]);
      const RollAdd = await DataInsert(
        `tbl_staff_roll`,
        `customers, orders, expense, service, reports, tools, mail,
           master, sms, staff, pos, rollaccess, account, coupon,
           branch_n_store, master_setting, Pay_Out, notification_setting, notification_templates, store_setting, printer_setting, all_staff_records, customer_credentials,
           pickup_requests, racks, route_calendar, pos_price_discount_override, order_payment_collect, financial_reports, main_roll_id, staff_id,is_staff`,
        `'${rcStaff.customers}', '${rcStaff.orders}', '${rcStaff.expense}', '${rcStaff.service}', '${rcStaff.reports}', '${rcStaff.tools}', '${rcStaff.mail}',
           '${rcStaff.master}', '${rcStaff.sms}', '${rcStaff.staff}', '${rcStaff.pos}', '${rcStaff.rollaccess}', '${rcStaff.account}', '${rcStaff.coupon}','${rcStaff.branch_n_store}', '${rcStaff.master_setting}', '${rcStaff.Pay_Out}','${rcStaff.notification_setting}','${rcStaff.notification_templates}','${rcStaff.store_setting}','${rcStaff.printer_setting}','${rcStaff.all_staff_records}','${rcStaff.customer_credentials}',
           '${rcStaff.pickup_requests}','${rcStaff.racks}','${rcStaff.route_calendar}','${rcStaff.pos_price_discount_override}','${rcStaff.order_payment_collect}','${rcStaff.financial_reports}','${RollFind[0].id}','${newroll.insertId}','1'`,
        req.hostname,
        req.protocol,
      );

      if (RollAdd == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      //  const updateRoll = await DataFind(`
      //  UPDATE tbl_admin
      //  SET roll_id = '${RollAdd.insertId}'
      //  WHERE id = '${newroll.insertId}'
      //  `);

      const updateRoll = await DataUpdate(
        "tbl_admin",
        `roll_id = '${RollAdd.insertId}'`,
        `id = '${newroll.insertId}'`,
        req.hostname,
        req.protocol,
      );

      if (updateRoll === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Staff Added !!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updatestaff/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
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

    if (rolldetail[0].staff.includes("edit")) {
      var dataid = req.params.id;
      var {
        name_update,
        number_update,
        email_update,
        username_update,
        password_update,
        roll_list_update,
        active_update,
        store_update,
      } = req.body;

      console.log(req.body);

      active_update ? (active_update = 1) : (active_update = 0);

      let OldData = await DataFind(
        `SELECT * FROM tbl_admin WHERE id=${dataid}`,
      );
      let haspass = "";

      if (password_update && password_update.length > 0) {
        const salt = bcrypt.genSaltSync(10);
        haspass = bcrypt.hashSync(password_update, salt);
      } else {
        haspass = OldData[0].password;
      }

      const assignedStore =
        store_update !== undefined &&
        store_update !== null &&
        store_update !== ""
          ? store_update
          : OldData[0].store_ID || "";

      const rollIdVal =
        roll_list_update && roll_list_update !== ""
          ? roll_list_update
          : OldData[0].roll_id;

      const newroll = await DataUpdate(
        "tbl_admin",
        `name='${name_update}', number='${number_update}', email='${email_update}', username='${username_update}',
    password='${haspass}', roll_id='${rollIdVal}', store_ID='${assignedStore}', approved='${active_update}'`,
        `id=${dataid}`,
        req.hostname,
        req.protocol,
      );

      if (newroll === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      // If admin reassigned the staff member's Role Preset in Edit Staff modal, sync tbl_staff_roll
      const newPresetId = req.body.main_roll_id_update ? parseInt(req.body.main_roll_id_update, 10) : 0;
      if (newPresetId > 0) {
        const currentStaffRoll = await DataFind(
          `SELECT id, main_roll_id FROM tbl_staff_roll WHERE id='${rollIdVal}' OR staff_id='${dataid}' ORDER BY id DESC LIMIT 1`,
        );
        const existingMainRollId = currentStaffRoll && currentStaffRoll[0] ? Number(currentStaffRoll[0].main_roll_id) : 0;
        const applyPresetChecked = req.body.apply_role_preset === "1" || existingMainRollId !== newPresetId;
        if (applyPresetChecked) {
          const presetRows = await DataFind(`SELECT * FROM tbl_roll WHERE id='${newPresetId}' AND delet_flage=0 LIMIT 1`);
          if (presetRows && presetRows.length > 0) {
            const rc = buildRoleCopyFields(presetRows[0]);
            const updateSql = Object.keys(rc).map((k) => `${k}='${rc[k]}'`).join(", ") + `, main_roll_id='${presetRows[0].id}'`;
            if (currentStaffRoll && currentStaffRoll.length > 0) {
              await DataUpdate("tbl_staff_roll", updateSql, `id='${currentStaffRoll[0].id}'`, req.hostname, req.protocol);
            } else {
              const insertedSr = await DataInsert(
                "tbl_staff_roll",
                `${Object.keys(rc).join(", ")}, main_roll_id, staff_id, is_staff`,
                `${Object.keys(rc).map((k) => `'${rc[k]}'`).join(", ")}, '${presetRows[0].id}', '${dataid}', '1'`,
                req.hostname,
                req.protocol,
              );
              if (insertedSr && insertedSr.insertId) {
                await DataUpdate("tbl_admin", `roll_id='${insertedSr.insertId}'`, `id='${dataid}'`, req.hostname, req.protocol);
              }
            }
          }
        }
      }

      req.flash("success", "Staff Updated !!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/rolllist/:id", auth, async (req, res) => {
  try {
    const staffid = req.params.id;
    const storeid = await DataFind(
      "SELECT roll_id FROM tbl_admin WHERE id=" + staffid + "",
    );

    console.log(storeid);

    const rolllist = await DataFind(
      `SELECT tbl_roll.id, tbl_roll.roll ,tbl_roll.rollType FROM tbl_roll  WHERE delet_flage=0 AND roll_status='active' AND roll_id=${storeid[0].roll_id}`,
    );

    res.status(200).json({ rolllist, storeid });
  } catch (error) {
    console.log(error);
  }
});

//<<<<<<<<<<<<<< master settings >>>>>>>>>>>>>>>>>>>>>
router.get("/setting", auth, async (req, res) => {
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
    if (rolldetail[0].rollType === "master") {
      const masterstore = await DataFind(
        "SELECT * FROM tbl_master_shop where id=1",
      );
      const roll = await DataFind(
        "SELECT id, roll,rollType FROM tbl_roll WHERE rollType='master'",
      );

      const storeList = await DataFind(
        "SELECT * FROM tbl_store WHERE delete_flage='0' AND  status='1'",
      );
      console.log(masterstore);

      res.render("master_settings", {
        timezones,
        masterstore: masterstore[0],
        roll,
        storeList,
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

router.post(
  "/setmasterdata",
  auth,
  upload.fields([
    { name: "logo", axCount: 1 },
    { name: "favicon", axCount: 1 },
  ]),
  async (req, res) => {
    try {
      if (process.env.DISABLE_DB_WRITE === "true") {
        req.flash("error", "For demo purpose we disabled crud operations!!");
        return res.redirect(req.get("Referrer") || "/");
      }
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

      if (rolldetail[0].rollType === "master") {
        var {
          multy,
          custmor_selection,
          fromStore,
          store_approved,
          customer_approved,
          currency,
          Symbol_Placement,
          thousands_separator,
          timezone,
          storeroll,
          appname,
          onesignal_app_id,
          onesignal_api_key,
          twilio_sid,
          twilio_auth_token,
          twilio_phone_no,
          footer,
          invoice_printer_format,
          invoice_printer_name,
          tag_printer_format,
          tag_printer_name,
          printing_server_url,
          silent_print_enabled,
          printer_auto_cut,
          printer_open_cash_drawer,
          printer_copies,
          multi_language_enabled,
          ocr_server_url,
        } = req.body;

        console.log("req.body.fromStore", req.body.fromStore);

        multy ? (multy = multy) : (multy = 0);
        custmor_selection
          ? (custmor_selection = custmor_selection)
          : (custmor_selection = 0);
        store_approved
          ? (store_approved = store_approved)
          : (store_approved = 0);
        customer_approved
          ? (customer_approved = customer_approved)
          : (customer_approved = 0);
        Symbol_Placement
          ? (Symbol_Placement = Symbol_Placement)
          : (Symbol_Placement = 0);

        let invFormat =
          invoice_printer_format !== undefined
            ? parseInt(invoice_printer_format)
            : 1;
        let invName = (invoice_printer_name || "").trim().replace(/'/g, "\\'");
        let tagFormat =
          tag_printer_format !== undefined ? parseInt(tag_printer_format) : 0;
        let tagName = (tag_printer_name || "").trim().replace(/'/g, "\\'");

        let printServerUrl = (printing_server_url || "http://127.0.0.1:4321")
          .trim()
          .replace(/'/g, "\\'");
        let silentPrint =
          silent_print_enabled == "1" ||
          silent_print_enabled === 1 ||
          silent_print_enabled === "on"
            ? 1
            : 0;
        let autoCut =
          printer_auto_cut == "1" ||
          printer_auto_cut === 1 ||
          printer_auto_cut === "on"
            ? 1
            : 0;
        let cashDrawer =
          printer_open_cash_drawer == "1" ||
          printer_open_cash_drawer === 1 ||
          printer_open_cash_drawer === "on"
            ? 1
            : 0;
        let copiesCount =
          printer_copies !== undefined ? parseInt(printer_copies) || 1 : 1;
        let multiLangEnabled =
          multi_language_enabled == "1" ||
          multi_language_enabled === 1 ||
          multi_language_enabled === "on"
            ? 1
            : 0;
        let ocrServerUrl = (ocr_server_url || "http://127.0.0.1:5000/api/scan").trim().replace(/'/g, "\\'");

        if (req.files.favicon) {
          console.log("favicon", req.files.favicon);

          // await DataFind(
          //   `UPDATE tbl_master_shop SET app_favicon='${req.files.favicon[0].filename}'`
          // );

          const faviconUpdate = await DataUpdate(
            "tbl_master_shop",
            `app_favicon='${req.files.favicon[0].filename}'`,
            `1=1`,
            req.hostname,
            req.protocol,
          );

          if (faviconUpdate === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }

        if (req.files.logo) {
          console.log("favicon", req.files.logo);

          // await DataFind(
          //   `UPDATE tbl_master_shop SET app_logo='${req.files.logo[0].filename}'`
          // );

          const logoUpdate = await DataUpdate(
            "tbl_master_shop",
            `app_logo='${req.files.logo[0].filename}'`,
            `1=1`,
            req.hostname,
            req.protocol,
          );

          if (logoUpdate === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }
        let isvalidmulty = await DataFind(`SELECT * FROM tbl_master_shop `);

        // await DataFind(`UPDATE tbl_master_shop SET type=${multy},customer_selection='${custmor_selection}',fromStore='${fromStore}',currency_symbol='${currency}', currency_placement=${Symbol_Placement},thousands_separator=${thousands_separator},
        // customer_autoapprove=${customer_approved},store_autoapprove=${store_approved},timezone='${timezone}',footer='${footer}',storeroll=${storeroll},app_name='${appname}',
        // onesignal_app_id='${onesignal_app_id}', onesignal_api_key='${onesignal_api_key}',twilio_sid='${twilio_sid}',twilio_auth_token='${twilio_auth_token}',twilio_phone_no='${twilio_phone_no}'`);

        let existingMaster = await DataFind(`SELECT * FROM tbl_master_shop LIMIT 1`);
        let curLeadDays = (existingMaster.length > 0 && existingMaster[0].ready_lead_days !== undefined) ? existingMaster[0].ready_lead_days : 2;
        let curCutoff = (existingMaster.length > 0 && existingMaster[0].ready_cutoff_time) ? existingMaster[0].ready_cutoff_time : '13:00';
        let curReadyTime = (existingMaster.length > 0 && existingMaster[0].ready_time) ? existingMaster[0].ready_time : '16:00';
        let curWorkingDays = (existingMaster.length > 0 && existingMaster[0].ready_working_days) ? existingMaster[0].ready_working_days : '1,2,3,4,5,6';
        let curOneSignalId = (existingMaster.length > 0 && existingMaster[0].onesignal_app_id) ? existingMaster[0].onesignal_app_id : '';
        let curOneSignalKey = (existingMaster.length > 0 && existingMaster[0].onesignal_api_key) ? existingMaster[0].onesignal_api_key : '';
        let curTwilioSid = (existingMaster.length > 0 && existingMaster[0].twilio_sid) ? existingMaster[0].twilio_sid : '';
        let curTwilioToken = (existingMaster.length > 0 && existingMaster[0].twilio_auth_token) ? existingMaster[0].twilio_auth_token : '';
        let curTwilioPhone = (existingMaster.length > 0 && existingMaster[0].twilio_phone_no) ? existingMaster[0].twilio_phone_no : '';
        let defaultPaymentType = (req.body.default_payment_type || "Cash").trim().replace(/'/g, "\\'");

        const settingsUpdate = await DataUpdate(
          "tbl_master_shop",
          `type=${multy},
   customer_selection='${custmor_selection}',
   fromStore='${fromStore}',
   currency_symbol='${currency}',
   currency_placement=${Symbol_Placement},
   thousands_separator=${thousands_separator},
   customer_autoapprove=${customer_approved},
   store_autoapprove=${store_approved},
   timezone='${timezone}',
   footer='${footer}',
   storeroll=${storeroll},
   app_name='${appname}',
   default_payment_type='${defaultPaymentType}',
   onesignal_app_id='${curOneSignalId}',
   onesignal_api_key='${curOneSignalKey}',
   twilio_sid='${curTwilioSid}',
   twilio_auth_token='${curTwilioToken}',
   twilio_phone_no='${curTwilioPhone}',
   ready_lead_days=${curLeadDays},
   ready_cutoff_time='${curCutoff}',
   ready_time='${curReadyTime}',
   ready_working_days='${curWorkingDays}',
   multi_language_enabled=${multiLangEnabled},
   ocr_server_url='${ocrServerUrl}'`,
          `1=1`,
          req.hostname,
          req.protocol,
        );

        if (settingsUpdate === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        console.log("isvalidmulty", isvalidmulty[0].type);
        console.log("isvalidmulty", isvalidmulty[0]);
        console.log("fromStore", fromStore);

        console.log("multy", multy);

        if (isvalidmulty[0].type != multy) {
          if (multy) {
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET approved = 1 WHERE store_ID != '' AND approved=8"
            // );
            // var customertable = await DataFind(
            //   "UPDATE tbl_customer SET store_ID=reffstore, reffstore=''"
            // );
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET is_staff=1 WHERE id=1"
            // );
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET is_staff=0 WHERE id=2"
            // );
            // var admintable = await DataFind(
            //   `UPDATE tbl_admin SET store_ID='' WHERE id='${id}'`
            // );
            //  var admintable = await DataFind(
            //   `UPDATE tbl_admin SET store_ID='${fromStore}' WHERE store_ID=' ' AND is_staff='1'`
            // );

            const updateApprovedAdmins = await DataUpdate(
              "tbl_admin",
              "approved = 1",
              "store_ID != '' AND approved = 8",
              req.hostname,
              req.protocol,
            );

            if (updateApprovedAdmins === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const updateApprovedAdminsstaff = await DataUpdate(
              "tbl_admin",
              "approved = 1",
              "store_ID = ' ' AND approved = 8",
              req.hostname,
              req.protocol,
            );

            if (updateApprovedAdminsstaff === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const updateCustomerRef = await DataUpdate(
              "tbl_customer",
              "store_ID = reffstore, reffstore = ''",
              "1=1",
              req.hostname,
              req.protocol,
            );

            if (updateCustomerRef === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const setAdminStaff1 = await DataUpdate(
              "tbl_admin",
              "is_staff = 1",
              "id = 1",
              req.hostname,
              req.protocol,
            );

            if (setAdminStaff1 === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const setAdminStaff0 = await DataUpdate(
              "tbl_admin",
              "is_staff = 0",
              "id = 2",
              req.hostname,
              req.protocol,
            );

            if (setAdminStaff0 === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const clearAdminStoreId = await DataUpdate(
              "tbl_admin",
              "store_ID = ''",
              `id = '${id}'`,
              req.hostname,
              req.protocol,
            );

            if (clearAdminStoreId === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const assignStoreToAdmin = await DataUpdate(
              "tbl_admin",
              `store_ID = '${fromStore}'`,
              `store_ID = ' ' AND is_staff = '1'`,
              req.hostname,
              req.protocol,
            );

            if (assignStoreToAdmin === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }
          } else {
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET approved = 8 WHERE store_ID = '' AND approved=1"
            // );
            // var customertable = await DataFind(
            //   `UPDATE tbl_customer SET reffstore=store_ID, store_ID='${fromStore}'`
            // );
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET is_staff=0 WHERE id=1"
            // );
            // var admintable = await DataFind(
            //   "UPDATE tbl_admin SET is_staff=1 WHERE id=2"
            // );
            // var admintable = await DataFind(
            //   `UPDATE tbl_admin SET store_ID='${fromStore}' WHERE id='${id}'`
            // );

            const updateApprovedAdmins = await DataUpdate(
              "tbl_admin",
              "approved = 8",
              `store_ID = '' AND approved = 1`,
              req.hostname,
              req.protocol,
            );
            if (updateApprovedAdmins === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const updateCustomerStore = await DataUpdate(
              "tbl_customer",
              `reffstore = store_ID, store_ID = '${fromStore}'`,
              "1=1",
              req.hostname,
              req.protocol,
            );
            if (updateCustomerStore === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const setAdmin1Staff0 = await DataUpdate(
              "tbl_admin",
              "is_staff = 0",
              "id = 1",
              req.hostname,
              req.protocol,
            );
            if (setAdmin1Staff0 === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const setAdmin2Staff1 = await DataUpdate(
              "tbl_admin",
              "is_staff = 1",
              "id = 2",
              req.hostname,
              req.protocol,
            );
            if (setAdmin2Staff1 === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }

            const setStoreIdForAdmin = await DataUpdate(
              "tbl_admin",
              `store_ID = '${fromStore}'`,
              `id = '${id}'`,
              req.hostname,
              req.protocol,
            );
            if (setStoreIdForAdmin === -1) {
              req.flash(
                "error",
                "Action failed, please check input and try again",
              );
              return res.redirect("back");
            }
          }
        } else if (
          isvalidmulty[0].type == "0" &&
          isvalidmulty[0].fromStore != fromStore
        ) {
          const updateCustomerStore = await DataUpdate(
            "tbl_customer",
            `store_ID = '${fromStore}'`,
            "1=1",
            req.hostname,
            req.protocol,
          );
          console.log("updateCustomerStore", updateCustomerStore);

          if (updateCustomerStore === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }

          const updateadminStore = await DataUpdate(
            "tbl_admin",
            `store_ID = '${fromStore}'`,
            `id = '${id}'`,
            req.hostname,
            req.protocol,
          );
          console.log("updateadminStore", updateadminStore);

          if (updateadminStore === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }

        invalidateMultiLanguageCache();
        req.flash("success", "Master Setting Save Success Fully");
        res.redirect("back");
      } else {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }
    } catch (error) {
      console.log(error);
      req.flash("error", "An unexpected error occurred while saving settings.");
      return res.redirect("back");
    }
  },
);

// <<<<<<<<<<<<<<<<<<< Store POS Printer Settings >>>>>>>>>>>>>>>>>>
router.get("/printersetting", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasReadPermission =
      isMaster ||
      (accessdata.roll?.printer_setting?.includes("read")) ||
      (rolldetail.length > 0 && rolldetail[0].printer_setting && rolldetail[0].printer_setting.includes("read")) ||
      (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("read"));

    if (!hasReadPermission) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    let targetStoreId = req.query.store_id || store;
    if (!targetStoreId || targetStoreId === " " || targetStoreId === "" || targetStoreId == 0) {
      const adminData = await DataFind(
        `SELECT store_ID FROM tbl_admin WHERE id = ${id}`
      );
      if (adminData.length > 0 && adminData[0].store_ID) {
        targetStoreId = adminData[0].store_ID;
      }
    }

    // If master and still no targetStoreId, fetch first active store
    const stores = await DataFind("SELECT id, name, city FROM tbl_store WHERE delete_flage=0 AND status=1 ORDER BY id ASC");
    if ((!targetStoreId || targetStoreId == 0) && stores.length > 0) {
      targetStoreId = stores[0].id;
    }

    // Fetch master store defaults as fallback
    const masterData = await DataFind("SELECT * FROM tbl_master_shop WHERE id=1");
    const ms = masterData[0] || {};

    let storeData = null;
    if (targetStoreId) {
      const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = ${targetStoreId} LIMIT 1`);
      if (sRows.length > 0) storeData = sRows[0];
    }

    // Consolidate effective printer settings with fallback to mastershop
    const printerSettings = {
      invoice_printer_format: (storeData && storeData.invoice_printer_format !== null && storeData.invoice_printer_format !== undefined)
        ? storeData.invoice_printer_format : (ms.invoice_printer_format !== undefined ? ms.invoice_printer_format : 1),
      invoice_printer_name: (storeData && storeData.invoice_printer_name !== null && storeData.invoice_printer_name !== undefined && storeData.invoice_printer_name !== '')
        ? storeData.invoice_printer_name : (ms.invoice_printer_name || ''),
      tag_printer_format: (storeData && storeData.tag_printer_format !== null && storeData.tag_printer_format !== undefined)
        ? storeData.tag_printer_format : (ms.tag_printer_format !== undefined ? ms.tag_printer_format : 1),
      tag_printer_name: (storeData && storeData.tag_printer_name !== null && storeData.tag_printer_name !== undefined && storeData.tag_printer_name !== '')
        ? storeData.tag_printer_name : (ms.tag_printer_name || ''),
      printing_server_url: (storeData && storeData.printing_server_url)
        ? storeData.printing_server_url : (ms.printing_server_url || 'http://127.0.0.1:4321'),
      silent_print_enabled: (storeData && storeData.silent_print_enabled !== null && storeData.silent_print_enabled !== undefined)
        ? storeData.silent_print_enabled : (ms.silent_print_enabled !== undefined ? ms.silent_print_enabled : 1),
      printer_auto_cut: (storeData && storeData.printer_auto_cut !== null && storeData.printer_auto_cut !== undefined)
        ? storeData.printer_auto_cut : (ms.printer_auto_cut !== undefined ? ms.printer_auto_cut : 1),
      printer_open_cash_drawer: (storeData && storeData.printer_open_cash_drawer !== null && storeData.printer_open_cash_drawer !== undefined)
        ? storeData.printer_open_cash_drawer : (ms.printer_open_cash_drawer !== undefined ? ms.printer_open_cash_drawer : 0),
      printer_copies: (storeData && storeData.printer_copies)
        ? storeData.printer_copies : (ms.printer_copies || 1),
      invoice_barcode_enabled: (storeData && storeData.invoice_barcode_enabled !== null && storeData.invoice_barcode_enabled !== undefined)
        ? storeData.invoice_barcode_enabled : (ms.invoice_barcode_enabled !== undefined ? ms.invoice_barcode_enabled : 1),
      tag_barcode_enabled: (storeData && storeData.tag_barcode_enabled !== null && storeData.tag_barcode_enabled !== undefined)
        ? storeData.tag_barcode_enabled : (ms.tag_barcode_enabled !== undefined ? ms.tag_barcode_enabled : 1),
      ocr_server_url: (storeData && storeData.ocr_server_url)
        ? storeData.ocr_server_url : (ms.ocr_server_url || 'http://127.0.0.1:5000/api/scan')
    };

    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.printer_setting?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].printer_setting && rolldetail[0].printer_setting.includes("edit")) ||
      (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("edit"));
    const canEdit = isMaster || hasEditPermission;

    res.render("printer_setting", {
      targetStoreId,
      storeData,
      stores,
      isMaster,
      canEdit,
      printerSettings,
      accessdata,
      language: req.language_data,
      language_name: req.language_name
    });
  } catch (error) {
    console.error("Error loading printer settings:", error);
    req.flash("error", "Error loading printer settings");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/printersetting/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.printer_setting?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].printer_setting && rolldetail[0].printer_setting.includes("edit")) ||
      (!isMaster && rolldetail.length > 0 && rolldetail[0].master && rolldetail[0].master.includes("edit"));

    let userStore = store;
    if (!userStore || userStore === " " || userStore === "") {
      const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
      if (adminData.length > 0) userStore = adminData[0].store_ID;
    }

    const targetStoreId = req.params.id;
    const isAuthorized = isMaster || (userStore == targetStoreId && hasEditPermission);

    if (!isAuthorized) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const {
      invoice_printer_format,
      invoice_printer_name,
      tag_printer_format,
      tag_printer_name,
      printing_server_url,
      silent_print_enabled,
      printer_auto_cut,
      printer_open_cash_drawer,
      printer_copies,
      invoice_barcode_enabled,
      tag_barcode_enabled,
      ocr_server_url
    } = req.body;

    const invFormat = parseInt(invoice_printer_format) || 1;
    const invName = (invoice_printer_name || "").trim().replace(/'/g, "\\'");
    const tagFormat = parseInt(tag_printer_format) || 1;
    const tagName = (tag_printer_name || "").trim().replace(/'/g, "\\'");
    const printServerUrl = (printing_server_url || "http://127.0.0.1:4321").trim().replace(/'/g, "\\'");
    const ocrUrl = (ocr_server_url || "").trim().replace(/'/g, "\\'");
    const silentPrint = (silent_print_enabled === "1" || silent_print_enabled === 1 || silent_print_enabled === "on") ? 1 : 0;
    const autoCut = (printer_auto_cut === "1" || printer_auto_cut === 1 || printer_auto_cut === "on") ? 1 : 0;
    const cashDrawer = (printer_open_cash_drawer === "1" || printer_open_cash_drawer === 1 || printer_open_cash_drawer === "on") ? 1 : 0;
    const copiesCount = parseInt(printer_copies) || 1;
    const invBarcode = (invoice_barcode_enabled === "1" || invoice_barcode_enabled === 1 || invoice_barcode_enabled === "on") ? 1 : 0;
    const tagBarcode = (tag_barcode_enabled === "1" || tag_barcode_enabled === 1 || tag_barcode_enabled === "on") ? 1 : 0;

    const updateQuery = `
      invoice_printer_format=${invFormat},
      invoice_printer_name='${invName}',
      tag_printer_format=${tagFormat},
      tag_printer_name='${tagName}',
      printing_server_url='${printServerUrl}',
      ocr_server_url=${ocrUrl ? `'${ocrUrl}'` : 'NULL'},
      silent_print_enabled=${silentPrint},
      printer_auto_cut=${autoCut},
      printer_open_cash_drawer=${cashDrawer},
      printer_copies=${copiesCount},
      invoice_barcode_enabled=${invBarcode},
      tag_barcode_enabled=${tagBarcode}
    `;

    const result = await DataUpdate("tbl_store", updateQuery, `id=${targetStoreId}`, req.hostname, req.protocol);
    if (result === -1) {
      req.flash("error", "Failed to update printer settings");
      return res.redirect("back");
    }

    req.flash("success", "Store Printer Settings Saved Successfully!");
    return res.redirect("back");
  } catch (error) {
    console.error("Error saving printer settings:", error);
    req.flash("error", "Error saving printer settings");
    return res.redirect("back");
  }
});

// <<<<<<<<<<<<<<<<<<< Test Print Endpoints >>>>>>>>>>>>>>>>>>
router.get("/test-print-invoice", auth, async (req, res) => {
  try {
    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop WHERE id=1",
    );
    const ms = masterstore[0] || {};

    let storeObj = null;
    if (req.query.store_id) {
      const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = ${req.query.store_id} LIMIT 1`);
      if (sRows.length > 0) storeObj = sRows[0];
    }

    const format =
      req.query.format !== undefined
        ? parseInt(req.query.format)
        : (storeObj && storeObj.invoice_printer_format !== null) ? storeObj.invoice_printer_format : (ms.invoice_printer_format || 1);
    const printerName =
      req.query.printer || (storeObj && storeObj.invoice_printer_name) || ms.invoice_printer_name || "Default Printer";
    const symbol = ms.currency_symbol || "$";

    const formatName =
      format === 0
        ? "A4 Full Sheet"
        : format === 2
          ? "58mm Thermal POS"
          : "80mm Thermal POS";
    const widthStyle =
      format === 0
        ? "max-width: 780px; margin: 20px auto; padding: 30px; font-family: 'Segoe UI', Tahoma, sans-serif;"
        : format === 2
          ? "width: 54mm; margin: 0 auto; padding: 8px 4px; font-family: monospace; font-size: 11px;"
          : "width: 76mm; margin: 0 auto; padding: 12px 6px; font-family: monospace; font-size: 12px;";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Invoice Print - ${ms.app_name || ""}</title>
  <style>
    @page { margin: 2mm; size: ${format === 0 ? "A4" : "auto"}; }
    body { margin: 0; padding: 0; background: #f8fafc; color: #0f172a; }
    .no-print-bar { background: #0081ee; color: #fff; padding: 10px 15px; font-family: sans-serif; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 10px rgba(0,0,0,0.15); }
    .no-print-bar button { background: #fff; color: #0081ee; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .print-sheet { background: #fff; border: 1px solid #e2e8f0; ${widthStyle} }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .border-b { border-bottom: 1px dashed #94a3b8; padding-bottom: 6px; margin-bottom: 6px; }
    .border-t { border-top: 1px dashed #94a3b8; padding-top: 6px; margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th { text-align: left; border-bottom: 1px solid #cbd5e1; padding: 4px 0; }
    td { padding: 4px 0; }
    @media print {
      .no-print-bar { display: none !important; }
      body { background: #fff !important; }
      .print-sheet { border: none !important; box-shadow: none !important; margin: 0 !important; width: 100% !important; padding: 0 !important; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>TEST PRINT PREVIEW:</strong> ${formatName} &bull; Target: <em>${printerName}</em></div>
    <div>
      <button onclick="window.print()">Print Now</button>
      <button onclick="window.close()" style="background: rgba(255,255,255,0.2); color: #fff; margin-left: 8px;">Close</button>
    </div>
  </div>

  <div class="print-sheet">
    <div class="center border-b">
      <h2 style="margin: 4px 0;">${ms.app_name || ""}</h2>
      <div style="font-size: 0.9em;">Premium Garment Care & Laundry</div>
      <div style="font-size: 0.85em; color: #64748b;">123 Main Commercial Ave &bull; Tel: (555) 019-2834</div>
    </div>

    <div style="margin: 8px 0; font-size: 0.9em;">
      <div><strong>Order:</strong> #TEST-INV001</div>
      <div><strong>Date:</strong> ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
      <div><strong>Customer:</strong> John Doe (Walk-in)</div>
      <div><strong>Cashier:</strong> Admin Staff</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item / Service</th>
          <th class="center">Qty</th>
          <th class="right">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Men Suit (Dry Clean)</td>
          <td class="center">1</td>
          <td class="right">${symbol}24.50</td>
        </tr>
        <tr>
          <td>Formal Shirts (Wash & Press)</td>
          <td class="center">3</td>
          <td class="right">${symbol}18.00</td>
        </tr>
        <tr>
          <td>Winter Blanket (Heavy Wash)</td>
          <td class="center">1</td>
          <td class="right">${symbol}15.00</td>
        </tr>
      </tbody>
    </table>

    <div class="border-t" style="font-size: 0.95em;">
      <div style="display: flex; justify-content: space-between;"><span>Subtotal:</span><span>${symbol}57.50</span></div>
      <div style="display: flex; justify-content: space-between;"><span>Tax (10%):</span><span>${symbol}5.75</span></div>
      <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1em; margin-top: 4px; border-top: 1px solid #94a3b8; padding-top: 4px;">
        <span>GROSS TOTAL:</span><span>${symbol}63.25</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: #16a34a; font-weight: 600; margin-top: 2px;">
        <span>Paid (Cash):</span><span>${symbol}63.25</span>
      </div>
    </div>

    <div class="center border-t" style="margin-top: 14px; font-size: 0.85em; color: #475569;">
      <div>*** SUCCESSFUL TEST RECEIPT ***</div>
      <div>Invoice Printer: ${formatName}</div>
      <div style="margin-top: 6px;">Thank you for choosing ${ms.app_name || ""}!</div>
    </div>
  </div>

  <script>
    setTimeout(function() {
      // Auto trigger print after render
      // window.print();
    }, 600);
  </script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating test invoice");
  }
});

router.get("/test-print-tag", auth, async (req, res) => {
  try {
    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop WHERE id=1",
    );
    let storeObj = null;
    if (req.query.store_id) {
      const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = ${req.query.store_id} LIMIT 1`);
      if (sRows.length > 0) storeObj = sRows[0];
    }

    const format =
      req.query.format !== undefined
        ? parseInt(req.query.format)
        : (storeObj && storeObj.tag_printer_format !== null) ? storeObj.tag_printer_format : (ms.tag_printer_format !== undefined ? ms.tag_printer_format : 1);
    const printerName =
      req.query.printer || (storeObj && storeObj.tag_printer_name) || ms.tag_printer_name || "Default Tag Printer";

    const formatName =
      format === 0
        ? '2" × 1" (50×25mm) Barcode Label'
        : format === 1
          ? '3" × 2" (75×50mm) Garment Cloth Tag'
          : format === 2
            ? "80mm Continuous Tag Roll"
            : "A4 Sheet Multi-Stickers";

    const widthStyle =
      format === 0
        ? "width: 50mm; height: 25mm; padding: 2mm 3mm; font-size: 9px;"
        : format === 1
          ? "width: 75mm; height: 50mm; padding: 4mm 5mm; font-size: 11px;"
          : format === 2
            ? "width: 76mm; padding: 6mm 4mm; font-size: 11px;"
            : "width: 100%; max-width: 750px; padding: 20px; font-size: 12px;";

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Test Tag Print - ${ms.app_name || ""}</title>
  <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
  <style>
    @page { margin: 1mm; size: ${format === 3 ? "A4" : "auto"}; }
    body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; color: #000; }
    .no-print-bar { background: #0284c7; color: #fff; padding: 10px 15px; font-family: sans-serif; display: flex; justify-content: space-between; align-items: center; }
    .no-print-bar button { background: #fff; color: #0284c7; border: none; padding: 6px 16px; border-radius: 6px; font-weight: 600; cursor: pointer; }
    .tag-container { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px 0; }
    .garment-tag { background: #fff; border: 1.5px dashed #334155; box-sizing: border-box; overflow: hidden; display: flex; flex-direction: column; justify-content: space-between; margin-bottom: 12px; ${widthStyle} }
    .tag-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #000; padding-bottom: 2px; font-weight: bold; }
    .tag-body { margin-top: 2px; line-height: 1.25; }
    .barcode-wrap { text-align: center; margin: 2px 0; }
    .barcode-svg { width: 100% !important; max-height: ${format === 0 ? "16px" : "26px"}; }
    @media print {
      .no-print-bar { display: none !important; }
      body { background: #fff !important; }
      .tag-container { padding: 0 !important; }
      .garment-tag { border: 1px solid #000 !important; margin: 0 !important; page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <div><strong>TEST TAG PREVIEW:</strong> ${formatName} &bull; Target: <em>${printerName}</em></div>
    <div>
      <button onclick="window.print()">Print Now</button>
      <button onclick="window.close()" style="background: rgba(255,255,255,0.2); color: #fff; margin-left: 8px;">Close</button>
    </div>
  </div>

  <div class="tag-container">
    <div class="garment-tag">
      <div class="tag-header">
        <span>${ms.app_name || ""}</span>
        <span>#ORD0392 [1/2]</span>
      </div>
      <div class="tag-body">
        <div><strong>Cust:</strong> Watson (17899888455)</div>
        <div><strong>Item:</strong> Men Silk Shirt &bull; <em>Dry Clean</em></div>
        ${format !== 0 ? "<div><strong>Deliv:</strong> " + new Date().toLocaleDateString() + " (Express)</div>" : ""}
      </div>
      <div class="barcode-wrap">
        <svg id="barcode1" class="barcode-svg"></svg>
      </div>
    </div>

    ${
      format === 2
        ? `
    <div class="garment-tag">
      <div class="tag-header">
        <span>${ms.app_name || ""}</span>
        <span>#ORD0392 [2/2]</span>
      </div>
      <div class="tag-body">
        <div><strong>Cust:</strong> Watson (17899888455)</div>
        <div><strong>Item:</strong> Wool Trousers &bull; <em>Steam Press</em></div>
      </div>
      <div class="barcode-wrap">
        <svg id="barcode2" class="barcode-svg"></svg>
      </div>
    </div>`
        : ""
    }
  </div>

  <script>
    try {
      JsBarcode("#barcode1", "ORD0392-01", {
        format: "CODE128",
        displayValue: true,
        fontSize: ${format === 0 ? 8 : 10},
        margin: 0,
        height: ${format === 0 ? 16 : 24}
      });
      if (document.getElementById("barcode2")) {
        JsBarcode("#barcode2", "ORD0392-02", {
          format: "CODE128",
          displayValue: true,
          fontSize: 10,
          margin: 0,
          height: 24
        });
      }
    } catch(e) { console.error(e); }
  </script>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generating test garment tag");
  }
});

// <<<<<<<<<<<<<<<<<<< Email setting >>>>>>>>>>>>>>>>>>
router.get("/mail", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    console.log(accessdata);

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
    if (accessdata.mutibranch == false || rolldetail[0].mail.includes("read")) {
      const effectiveStoreId = parseInt(store, 10) || 0;
      var data = await DataFind(
        `SELECT * FROM tbl_email WHERE store_id='${effectiveStoreId}'`,
      );
      if ((!data || data.length === 0) && effectiveStoreId === 0) {
        data = await DataFind("SELECT * FROM tbl_email ORDER BY id ASC LIMIT 1");
      }
      const twilioData = await resolveTwilioConfig(effectiveStoreId);
      return res.render("mailsetting", {
        accessdata,
        data,
        twilioData,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/mailsetting", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const effectiveStoreId = parseInt(store, 10) || 0;
    await saveEmailAndTwilioGateways(effectiveStoreId, req.body, req);

    req.flash("success", "Email & Twilio SMS Settings Saved Successfully!");
    return res.redirect("back");
  } catch (error) {
    console.log(error);
    req.flash("error", "Action failed, please check input and try again");
    return res.redirect("back");
  }
});

router.post("/rollstatus/:id", auth, async (req, res) => {
  if (process.env.DISABLE_DB_WRITE === "true") {
    req.flash("error", "For demo purpose we disabled crud operations!!");
    return res.redirect(req.get("Referrer") || "/");
  }
  console.log("req.body", req.body.status);
  console.log("req.params.id", req.params.id);

  let status = req.body.status;
  console.log("status", status);

  // await DataFind(
  //   `UPDATE tbl_roll SET roll_status='${status}' WHERE id='${req.params.id}'`
  // );

  const updateRollStatus = await DataUpdate(
    "tbl_roll",
    `roll_status='${status}'`,
    `id='${req.params.id}'`,
    req.hostname,
    req.protocol,
  );

  if (updateRollStatus === -1) {
    req.flash("error", "Action failed, please check input and try again");
    return res.redirect("back");
  }
});

router.post("/storestatus/:id", auth, async (req, res) => {
  if (process.env.DISABLE_DB_WRITE === "true") {
    req.flash("error", "For demo purpose we disabled crud operations!!");
    return res.redirect(req.get("Referrer") || "/");
  }
  console.log("req.body", req.body.status);
  console.log("req.params.id", req.params.id);

  let status = req.body.status == "active" ? "1" : "0";

  // await DataFind(
  //   `UPDATE tbl_admin SET approved='${status}' WHERE store_ID = '${req.params.id}'`
  // );

  // await DataFind(
  //   `UPDATE tbl_store SET status='${status}' WHERE id='${req.params.id}'`
  // );

  const updateAdmin = await DataUpdate(
    "tbl_admin",
    `approved='${status}'`,
    `store_ID='${req.params.id}'`,
    req.hostname,
    req.protocol,
  );

  if (updateAdmin === -1) {
    req.flash("error", "Action failed, please check input and try again");
    return res.redirect("back");
  }

  const updateStore = await DataUpdate(
    "tbl_store",
    `status='${status}'`,
    `id='${req.params.id}'`,
    req.hostname,
    req.protocol,
  );

  if (updateStore === -1) {
    req.flash("error", "Action failed, please check input and try again");
    return res.redirect("back");
  }
});

router.post("/rollUp/:id", async (req, res) => {
  try {
    console.log("body", req.body);
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    var {
      rollType,
      main_roll_id,
      orders,
      expense,
      service,
      reports,
      tools,
      mail,
      master,
      sms,
      staff,
      Pay_Out,
      customers,
      branch_n_store,
      pos,
      rollaccess,
      master_setting,
      coupon,
      account,
      notification_setting,
      notification_templates,
      store_setting,
      printer_setting,
      all_staff_records,
      customer_credentials,
      pickup_requests,
      racks,
      route_calendar,
      pos_price_discount_override,
      order_payment_collect,
      financial_reports,
    } = req.body;

    orders = normalizePermValue(orders);
    branch_n_store = normalizePermValue(branch_n_store);
    Pay_Out = normalizePermValue(Pay_Out);
    master_setting = normalizePermValue(master_setting);
    expense = normalizePermValue(expense);
    service = normalizePermValue(service);
    customers = normalizePermValue(customers);
    reports = normalizePermValue(reports);
    tools = normalizePermValue(tools);
    mail = normalizePermValue(mail);
    master = normalizePermValue(master);
    sms = normalizePermValue(sms);
    staff = normalizePermValue(staff);
    pos = normalizePermValue(pos);
    rollaccess = normalizePermValue(rollaccess);
    coupon = normalizePermValue(coupon);
    account = normalizePermValue(account);
    notification_setting = normalizePermValue(notification_setting);
    notification_templates = normalizePermValue(notification_templates);
    store_setting = normalizePermValue(store_setting);
    printer_setting = normalizePermValue(printer_setting);
    all_staff_records = normalizePermValue(all_staff_records);
    customer_credentials = normalizePermValue(customer_credentials);
    pickup_requests = normalizePermValue(pickup_requests);
    racks = normalizePermValue(racks);
    route_calendar = normalizePermValue(route_calendar);
    pos_price_discount_override = normalizePermValue(pos_price_discount_override);
    order_payment_collect = normalizePermValue(order_payment_collect);
    financial_reports = normalizePermValue(financial_reports);
    if (store_setting && !master) {
      master = store_setting;
    } else if (master && !store_setting) {
      store_setting = master;
    }

    const findroll = await DataFind(
      `SELECT * FROM tbl_staff_roll WHERE id='${req.params.id}' OR staff_id='${req.params.id}' ORDER BY id DESC LIMIT 1`,
    );

    const parsedMainRollId = main_roll_id ? parseInt(main_roll_id, 10) : 0;

    if (findroll.length > 0) {
      const mainRollClause = parsedMainRollId > 0 ? `,\n  main_roll_id = '${parsedMainRollId}'` : "";
      const rollUpdateFields = `
  customers = '${customers}',
  orders = '${orders}',
  expense = '${expense}',
  service = '${service}',
  reports = '${reports}',
  tools = '${tools}',
  mail = '${mail}',
  master = '${master}',
  sms = '${sms}',
  staff = '${staff}',
  pos = '${pos}',
  rollaccess = '${rollaccess}',
  account = '${account}',
  coupon = '${coupon}',
  branch_n_store = '${branch_n_store}',
  master_setting = '${master_setting}',
  Pay_Out = '${Pay_Out}',
  notification_setting = '${notification_setting}',
  notification_templates = '${notification_templates}',
  store_setting = '${store_setting}',
  printer_setting = '${printer_setting}',
  all_staff_records = '${all_staff_records}',
  customer_credentials = '${customer_credentials}',
  pickup_requests = '${pickup_requests}',
  racks = '${racks}',
  route_calendar = '${route_calendar}',
  pos_price_discount_override = '${pos_price_discount_override}',
  order_payment_collect = '${order_payment_collect}',
  financial_reports = '${financial_reports}'${mainRollClause}
`;

      const newroll = await DataUpdate(
        "tbl_staff_roll",
        rollUpdateFields,
        `id = '${findroll[0].id}'`,
        req.hostname,
        req.protocol,
      );

      // Ensure tbl_admin.roll_id is linked to this staff_roll record
      const targetStaffId = findroll[0].staff_id || req.params.id;
      if (targetStaffId) {
        await DataUpdate(
          "tbl_admin",
          `roll_id = '${findroll[0].id}'`,
          `id = '${targetStaffId}'`,
          req.hostname,
          req.protocol,
        );
      }

      if (newroll === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Your Roll Updated !");
      res.redirect("back");
    } else {
      const findtype = await DataFind(
        parsedMainRollId > 0
          ? `SELECT * FROM tbl_roll WHERE id='${parsedMainRollId}'`
          : `SELECT * FROM tbl_roll WHERE rollType='${rollType || "store"}' ORDER BY id ASC LIMIT 1`,
      );
      const fallbackMainId = (findtype && findtype[0] && findtype[0].id) ? findtype[0].id : 2;

      const newroll = await DataInsert(
        `tbl_staff_roll`,
        `customers, orders, expense, service, reports, tools, mail,
         master, sms, staff, pos, rollaccess, account, coupon,
         branch_n_store, master_setting, Pay_Out, notification_setting, notification_templates, store_setting, printer_setting, all_staff_records, customer_credentials,
         pickup_requests, racks, route_calendar, pos_price_discount_override, order_payment_collect, financial_reports, main_roll_id, staff_id,is_staff`,
        `'${customers}', '${orders}', '${expense}', '${service}', '${reports}', '${tools}', '${mail}',
         '${master}', '${sms}', '${staff}', '${pos}', '${rollaccess}', '${account}', '${coupon}',
         '${branch_n_store}', '${master_setting}', '${Pay_Out}', '${notification_setting}', '${notification_templates}', '${store_setting}', '${printer_setting}','${all_staff_records}','${customer_credentials}',
         '${pickup_requests}','${racks}','${route_calendar}','${pos_price_discount_override}','${order_payment_collect}','${financial_reports}','${fallbackMainId}','${req.params.id}','1'`,
        req.hostname,
        req.protocol,
      );

      if (newroll == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      const updateRollId = await DataUpdate(
        "tbl_admin",
        `roll_id = '${newroll.insertId}'`,
        `id = '${req.params.id}'`,
        req.hostname,
        req.protocol,
      );

      if (updateRollId === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Roll Added !");
      res.redirect("back");
    }
  } catch (err) {
    console.log(err);
  }
});

router.get("/rolldetailstaff/:id", async (req, res) => {
  try {
    const id = req.params.id;
    console.log("req.params.id", req.params.id);

    const newroll = await DataFind(
      `SELECT sr.*, COALESCE(r.roll, '') AS roll, COALESCE(r.rollType, 'store') AS rollType,
              r.orders AS ceiling_orders, r.expense AS ceiling_expense, r.service AS ceiling_service,
              r.reports AS ceiling_reports, r.tools AS ceiling_tools, r.mail AS ceiling_mail,
              r.master AS ceiling_master, r.sms AS ceiling_sms, r.staff AS ceiling_staff,
              r.pos AS ceiling_pos, r.customers AS ceiling_customers, r.master_setting AS ceiling_master_setting,
              r.branch_n_store AS ceiling_branch_n_store, r.Pay_Out AS ceiling_Pay_Out, r.account AS ceiling_account,
              r.coupon AS ceiling_coupon, r.rollaccess AS ceiling_rollaccess,
              r.notification_setting AS ceiling_notification_setting, r.notification_templates AS ceiling_notification_templates,
              r.store_setting AS ceiling_store_setting, r.printer_setting AS ceiling_printer_setting,
              r.all_staff_records AS ceiling_all_staff_records, r.customer_credentials AS ceiling_customer_credentials,
              r.pickup_requests AS ceiling_pickup_requests, r.racks AS ceiling_racks,
              r.route_calendar AS ceiling_route_calendar, r.pos_price_discount_override AS ceiling_pos_price_discount_override,
              r.order_payment_collect AS ceiling_order_payment_collect, r.financial_reports AS ceiling_financial_reports
       FROM tbl_staff_roll sr
       LEFT JOIN tbl_roll r ON sr.main_roll_id = r.id
       WHERE sr.id = '${id}' OR sr.staff_id = '${id}'
       ORDER BY sr.id DESC LIMIT 1`,
    );
    console.log(newroll);

    res.status(200).json({ rolldata: newroll[0] });
  } catch (error) {
    console.log(error);
  }
});

router.get("/staffroll/:id", auth, async (req, res) => {
  try {
    const staffid = req.params.id;
    const storeid = await DataFind(
      "SELECT roll_id FROM tbl_admin WHERE id=" + staffid + "",
    );

    console.log(storeid);

    const rolllist = await DataFind(
      `SELECT tbl_roll.id, tbl_roll.roll ,tbl_roll.rollType FROM tbl_roll  WHERE delet_flage=0 AND roll_status='active' AND roll_id=${storeid[0].roll_id}`,
    );

    res.status(200).json({ rolllist, storeid });
  } catch (error) {
    console.log(error);
  }
});

router.post("/staffroll/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({ success: false, message: "For demo purpose we disabled crud operations!!" });
    }

    const rawStatus = req.body.status;
    const status = (rawStatus === "active" || rawStatus === "1" || rawStatus === 1 || rawStatus === true) ? "1" : "0";

    const updateAdminStatus = await DataUpdate(
      "tbl_admin",
      `approved = '${status}'`,
      `id = '${req.params.id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateAdminStatus === -1) {
      return res.status(400).json({ success: false, message: "Action failed, please check input and try again" });
    }

    return res.status(200).json({ success: true, status });
  } catch (error) {
    console.error("Error updating staff status:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
});

router.post("/download", auth, async (req, res) => {
  const { transectionList } = req.body;

  const filename = `Transaction_Report-${Date.now()}.xlsx`;
  const sheetname = "Transactions";

  const xlsxdata = [
    ["Date", "Account", "Type", "Description", "Debit", "Credit", "Balance"],
  ];

  transectionList.forEach((pdata) => {
    const formattedDate = pdata.date
      ?.split("T")[0]
      ?.split("-")
      .reverse()
      .join("-");
    xlsxdata.push([
      formattedDate,
      pdata.ac_name,
      pdata.transec_type,
      pdata.transec_detail,
      pdata.debit_amount,
      pdata.credit_amount,
      pdata.balance_amount,
    ]);
  });

  const workbook = XLSX.utils.book_new();
  console.log("workbook", workbook);

  const worksheet = XLSX.utils.aoa_to_sheet(xlsxdata);
  console.log("worksheet", worksheet);

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetname);
  // console.log("XLSX.utils.book_append_sheet(workbook, worksheet, sheetname)",XLSX.utils.book_append_sheet(workbook, worksheet, sheetname));

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  console.log("buffer", buffer);
  console.log("filename", filename);

  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.send(buffer);
});

// <<<<<<<<<<<<<<<<<<< Customer Notification Settings >>>>>>>>>>>>>>>>>>
router.get("/notificationsetting", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasReadAccess =
      isMaster ||
      accessdata.mutibranch === false ||
      (accessdata.roll?.notification_setting?.includes("read")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_setting && rolldetail[0].notification_setting.includes("read")) ||
      (rolldetail.length > 0 &&
        ((rolldetail[0].mail && rolldetail[0].mail.includes("read")) ||
          (rolldetail[0].sms && rolldetail[0].sms.includes("read")) ||
          (rolldetail[0].master && rolldetail[0].master.includes("read")) ||
          (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("read"))));

    if (!hasReadAccess) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.notification_setting?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_setting && rolldetail[0].notification_setting.includes("edit")) ||
      (accessdata.mutibranch === false &&
        (rolldetail.length > 0 &&
          ((rolldetail[0].mail && rolldetail[0].mail.includes("edit")) ||
            (rolldetail[0].sms && rolldetail[0].sms.includes("edit")) ||
            (rolldetail[0].master && rolldetail[0].master.includes("edit")) ||
            (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("edit")))));

    const stores = await DataFind(
      "SELECT id, name, city FROM tbl_store WHERE delete_flage=0 AND status=1 ORDER BY id ASC"
    );

    let targetStoreId = 0;
    if (isMaster) {
      if (req.query.store_id !== undefined && req.query.store_id !== "") {
        targetStoreId = parseInt(req.query.store_id, 10) || 0;
      } else {
        targetStoreId = 0; // Default to Global Defaults for Master Admin
      }
    } else {
      let assignedStore = store;
      if (!assignedStore || assignedStore === " " || assignedStore === "" || assignedStore == 0) {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0 && adminData[0].store_ID) {
          assignedStore = adminData[0].store_ID;
        }
      }
      targetStoreId = parseInt(assignedStore, 10) || (stores[0] ? stores[0].id : 0);
    }

    let storeData = null;
    if (targetStoreId > 0) {
      const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = ${targetStoreId} LIMIT 1`);
      if (sRows.length > 0) storeData = sRows[0];
    }

    const notifSettings = await getEffectiveNotificationSettings(targetStoreId);
    const smtpCfg = await resolveSmtpConfig(targetStoreId);
    const twilioCfg = await resolveTwilioConfig(targetStoreId);
    const openwaCfg = await resolveOpenWaConfig(targetStoreId);

    const smtpConfigured = Boolean(smtpCfg && smtpCfg.host && smtpCfg.username && smtpCfg.password);
    const twilioConfigured = Boolean(
      twilioCfg &&
      twilioCfg.sid &&
      twilioCfg.token &&
      twilioCfg.phone &&
      String(twilioCfg.status) === "1"
    );
    const openwaConfigured = Boolean(openwaCfg && openwaCfg.isConfigured);
    const pushConfigured = Boolean(
      accessdata &&
      accessdata.masterstore &&
      accessdata.masterstore.onesignal_app_id &&
      accessdata.masterstore.onesignal_api_key
    );

    return res.render("notification_setting", {
      targetStoreId,
      storeData,
      stores,
      isMaster,
      canEdit: hasEditPermission,
      notifSettings,
      notificationEvents: NOTIFICATION_EVENTS,
      smtpConfig: smtpCfg || {},
      twilioConfig: twilioCfg || {},
      openwaConfig: openwaCfg || {},
      smtpConfigured,
      twilioConfigured,
      openwaConfigured,
      pushConfigured,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("Error loading notification settings:", error);
    req.flash("error", "Error loading notification settings");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/notificationsetting", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.notification_setting?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_setting && rolldetail[0].notification_setting.includes("edit")) ||
      (accessdata.mutibranch === false &&
        (rolldetail.length > 0 &&
          ((rolldetail[0].mail && rolldetail[0].mail.includes("edit")) ||
            (rolldetail[0].sms && rolldetail[0].sms.includes("edit")) ||
            (rolldetail[0].master && rolldetail[0].master.includes("edit")) ||
            (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("edit")))));

    if (!hasEditPermission) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    let targetStoreId = parseInt(req.body.target_store_id, 10) || 0;

    if (!isMaster) {
      let userStore = store;
      if (!userStore || userStore === " " || userStore === "") {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0) userStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(userStore, 10) || 0;
    }

    await saveEmailAndTwilioGateways(targetStoreId, req.body, req);
    const saved = await saveNotificationSettings(targetStoreId, req.body, req);
    if (!saved) {
      req.flash("error", "Failed to save notification settings");
      return res.redirect(`/tool/notificationsetting?store_id=${targetStoreId}`);
    }

    req.flash("success", "Notification, Email, Twilio & Open-WA WhatsApp Settings Saved Successfully!");
    return res.redirect(`/tool/notificationsetting?store_id=${targetStoreId}`);
  } catch (error) {
    console.error("Error saving notification settings:", error);
    req.flash("error", "Error saving notification settings");
    return res.redirect("back");
  }
});

router.get("/notificationsetting/openwa-session", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    const accessdata = await access(req.user);
    const rolldetail = await DataFind(`
      SELECT sr.*, r.rollType
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasReadAccess =
      isMaster ||
      accessdata.mutibranch === false ||
      (accessdata.roll?.notification_setting?.includes("read")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_setting && rolldetail[0].notification_setting.includes("read")) ||
      (rolldetail.length > 0 &&
        ((rolldetail[0].mail && rolldetail[0].mail.includes("read")) ||
          (rolldetail[0].sms && rolldetail[0].sms.includes("read")) ||
          (rolldetail[0].master && rolldetail[0].master.includes("read")) ||
          (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("read"))));

    if (!hasReadAccess) {
      return res.status(403).json({ success: false, message: "You are not authorized to inspect Open-WA sessions." });
    }

    let targetStoreId = parseInt(req.query.store_id, 10) || 0;
    if (!isMaster) {
      let assignedStore = store;
      if (!assignedStore || assignedStore === " " || assignedStore === "" || assignedStore == 0) {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0 && adminData[0].store_ID) assignedStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(assignedStore, 10) || 0;
    }

    const result = await getOpenWaSessionStatusAndQr({
      storeId: targetStoreId,
      baseUrl: req.query.base_url,
      apiKey: req.query.api_key,
      sessionId: req.query.session_id,
      autoStart: req.query.auto_start === "1" || req.query.auto_start === "true",
      createIfMissing: req.query.create === "1" || req.query.create === "true",
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error inspecting Open-WA session:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to connect to Open-WA server." });
  }
});

router.post("/notificationsetting/openwa-session/action", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({ success: false, message: "For demo purpose we disabled crud operations!!" });
    }

    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }
    const accessdata = await access(req.user);
    const rolldetail = await DataFind(`
      SELECT sr.*, r.rollType
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.notification_setting?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_setting && rolldetail[0].notification_setting.includes("edit")) ||
      (accessdata.mutibranch === false &&
        (rolldetail.length > 0 &&
          ((rolldetail[0].mail && rolldetail[0].mail.includes("edit")) ||
            (rolldetail[0].sms && rolldetail[0].sms.includes("edit")) ||
            (rolldetail[0].master && rolldetail[0].master.includes("edit")) ||
            (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("edit")))));

    if (!hasEditPermission) {
      return res.status(403).json({ success: false, message: "Administrative edit privileges are required to control Open-WA sessions." });
    }

    let targetStoreId = parseInt(req.body.store_id, 10) || 0;
    if (!isMaster) {
      let assignedStore = store;
      if (!assignedStore || assignedStore === " " || assignedStore === "" || assignedStore == 0) {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0 && adminData[0].store_ID) assignedStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(assignedStore, 10) || 0;
    }

    const result = await controlOpenWaSession({
      storeId: targetStoreId,
      action: req.body.action || "start",
      baseUrl: req.body.base_url,
      apiKey: req.body.api_key,
      sessionId: req.body.session_id,
    });

    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error controlling Open-WA session:", error);
    return res.status(500).json({ success: false, message: error.message || "Failed to execute Open-WA session action." });
  }
});

router.post("/notificationsetting/reset", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({
        success: false,
        message: "For demo purpose we disabled crud operations!!",
      });
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.rollType
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";

    let targetStoreId = parseInt(req.body.store_id, 10) || 0;
    if (!isMaster) {
      let userStore = store;
      if (!userStore || userStore === " " || userStore === "") {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0) userStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(userStore, 10) || 0;
    }

    if (targetStoreId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Global defaults cannot be deleted; use Enable All / Disable All instead.",
      });
    }

    await resetStoreNotificationSettings(targetStoreId);
    return res.status(200).json({
      success: true,
      message: "Store override removed. Now inheriting Global Default Notification Settings.",
    });
  } catch (error) {
    console.error("Error resetting notification settings:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/notificationsetting/test", auth, async (req, res) => {
  try {
    const { loginas } = req.user;
    if (loginas == 0) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const storeId = parseInt(req.body.store_id, 10) || 0;
    const channel = String(req.body.channel || "email").toLowerCase();
    const recipient = String(req.body.recipient || "").trim();

    const result = await sendTestNotification({ storeId, channel, recipient });
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("Error sending test notification:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to send test notification",
    });
  }
});

// <<<<<<<<<<<<<<<<<<< Customer Notification Templates Editor >>>>>>>>>>>>>>>>>>
router.get("/notification-templates", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasReadAccess =
      isMaster ||
      accessdata.mutibranch === false ||
      (accessdata.roll?.notification_templates?.includes("read")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_templates && rolldetail[0].notification_templates.includes("read")) ||
      (rolldetail.length > 0 &&
        ((rolldetail[0].mail && rolldetail[0].mail.includes("read")) ||
          (rolldetail[0].sms && rolldetail[0].sms.includes("read")) ||
          (rolldetail[0].master && rolldetail[0].master.includes("read")) ||
          (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("read"))));

    if (!hasReadAccess) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.notification_templates?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_templates && rolldetail[0].notification_templates.includes("edit")) ||
      (accessdata.mutibranch === false &&
        (rolldetail.length > 0 &&
          ((rolldetail[0].mail && rolldetail[0].mail.includes("edit")) ||
            (rolldetail[0].sms && rolldetail[0].sms.includes("edit")) ||
            (rolldetail[0].master && rolldetail[0].master.includes("edit")) ||
            (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("edit")))));

    const stores = await DataFind(
      "SELECT id, name, city FROM tbl_store WHERE delete_flage=0 AND status=1 ORDER BY id ASC"
    );

    let targetStoreId = 0;
    if (isMaster) {
      if (req.query.store_id !== undefined && req.query.store_id !== "") {
        targetStoreId = parseInt(req.query.store_id, 10) || 0;
      } else {
        targetStoreId = 0;
      }
    } else {
      let assignedStore = store;
      if (!assignedStore || assignedStore === " " || assignedStore === "" || assignedStore == 0) {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0 && adminData[0].store_ID) {
          assignedStore = adminData[0].store_ID;
        }
      }
      targetStoreId = parseInt(assignedStore, 10) || (stores[0] ? stores[0].id : 0);
    }

    let storeData = null;
    if (targetStoreId > 0) {
      const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = ${targetStoreId} LIMIT 1`);
      if (sRows.length > 0) storeData = sRows[0];
    }

    const notifSettings = await getEffectiveNotificationSettings(targetStoreId);

    return res.render("notification_templates", {
      targetStoreId,
      storeData,
      stores,
      isMaster,
      canEdit: hasEditPermission,
      notifSettings,
      notificationEvents: NOTIFICATION_EVENTS,
      templateVariables: TEMPLATE_VARIABLES,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("Error loading notification templates:", error);
    req.flash("error", "Error loading notification templates");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/notification-templates", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "You Are Not Authorized For this");
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

    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";
    const hasEditPermission =
      isMaster ||
      (accessdata.roll?.notification_templates?.includes("edit")) ||
      (rolldetail.length > 0 && rolldetail[0].notification_templates && rolldetail[0].notification_templates.includes("edit")) ||
      (accessdata.mutibranch === false &&
        (rolldetail.length > 0 &&
          ((rolldetail[0].mail && rolldetail[0].mail.includes("edit")) ||
            (rolldetail[0].sms && rolldetail[0].sms.includes("edit")) ||
            (rolldetail[0].master && rolldetail[0].master.includes("edit")) ||
            (rolldetail[0].master_setting && rolldetail[0].master_setting.includes("edit")))));

    if (!hasEditPermission) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    let targetStoreId = parseInt(req.body.target_store_id, 10) || 0;

    if (!isMaster) {
      let userStore = store;
      if (!userStore || userStore === " " || userStore === "") {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0) userStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(userStore, 10) || 0;
    }

    const saved = await saveNotificationTemplates(targetStoreId, req.body, req);
    if (!saved) {
      req.flash("error", "Failed to save notification templates");
      return res.redirect(`/tool/notification-templates?store_id=${targetStoreId}`);
    }

    req.flash("success", "WhatsApp, SMS & Email Notification Templates Saved Successfully!");
    return res.redirect(`/tool/notification-templates?store_id=${targetStoreId}`);
  } catch (error) {
    console.error("Error saving notification templates:", error);
    req.flash("error", "Error saving notification templates");
    return res.redirect("back");
  }
});

router.post("/notification-templates/reset", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({
        success: false,
        message: "For demo purpose we disabled crud operations!!",
      });
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.rollType
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster = rolldetail.length > 0 && rolldetail[0].rollType === "master";

    let targetStoreId = parseInt(req.body.store_id, 10) || 0;
    if (!isMaster) {
      let userStore = store;
      if (!userStore || userStore === " " || userStore === "") {
        const adminData = await DataFind(`SELECT store_ID FROM tbl_admin WHERE id = ${id}`);
        if (adminData.length > 0) userStore = adminData[0].store_ID;
      }
      targetStoreId = parseInt(userStore, 10) || 0;
    }

    const eventKey = req.body.event_key ? String(req.body.event_key).trim() : "all";
    await resetNotificationTemplates(targetStoreId, eventKey, req);

    return res.status(200).json({
      success: true,
      message: eventKey === "all"
        ? "All notification templates reset to default."
        : `Template for '${eventKey}' reset to default.`,
    });
  } catch (error) {
    console.error("Error resetting notification templates:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
