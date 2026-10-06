const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
const nodemailer = require("nodemailer");
let sendNotification = require("../middelwer/send");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind,
} = require("../middelwer/databaseQurey");
const { paginateDataTable } = require("../middelwer/dataTableHelper");
const {
  getEffectiveReadySchedule,
  calculateReadyDateTime,
} = require("../middelwer/readyScheduleHelper");

function formatMySQLDateTime(d, fallbackTime = "16:00:00") {
  if (!d) return null;
  if (typeof d === "string") {
    let trimmed = d.trim();
    if (trimmed.includes(" ") || trimmed.includes("T")) {
      let dt = new Date(trimmed);
      if (!isNaN(dt.getTime())) {
        let Y = dt.getFullYear();
        let M = String(dt.getMonth() + 1).padStart(2, "0");
        let D = String(dt.getDate()).padStart(2, "0");
        let H = String(dt.getHours()).padStart(2, "0");
        let m = String(dt.getMinutes()).padStart(2, "0");
        let s = String(dt.getSeconds()).padStart(2, "0");
        return `${Y}-${M}-${D} ${H}:${m}:${s}`;
      }
    } else {
      let t = fallbackTime.trim();
      if (t.length === 5) t += ":00";
      return `${trimmed} ${t}`;
    }
  } else if (d instanceof Date && !isNaN(d.getTime())) {
    let Y = d.getFullYear();
    let M = String(d.getMonth() + 1).padStart(2, "0");
    let D = String(d.getDate()).padStart(2, "0");
    let H = String(d.getHours()).padStart(2, "0");
    let m = String(d.getMinutes()).padStart(2, "0");
    let s = String(d.getSeconds()).padStart(2, "0");
    return `${Y}-${M}-${D} ${H}:${m}:${s}`;
  }
  return String(d);
}

async function idfororder() {
  const orderiddata = await DataFind(
    `SELECT id FROM tbl_order ORDER BY ID DESC LIMIT 1`,
  );
  if (orderiddata.length > 0) {
    var n = ++orderiddata[0].id;
  } else {
    var n = 1;
  }

  if (n < 10) {
    return "#ORD000" + n.toString();
  } else if (n < 100) {
    return "#ORD00" + n.toString();
  } else if (n < 1000) {
    return "#ORD0" + n.toString();
  } else {
    return "#ORD" + n;
  }
}

async function getStaffScope(userId, loginas) {
  if (loginas == 0) return { isStaff: false, staffStoreId: null };
  const adminData = await DataFind(
    `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${userId}`,
  );
  const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
  const staffStoreId = isStaff ? adminData[0].store_ID : null;
  return { isStaff, staffStoreId };
}

async function getOrCreateWalkInCustomer(storeId, req) {
  if (!storeId || storeId == "0" || storeId == "") return null;
  let walk = await DataFind(
    `SELECT * FROM tbl_customer WHERE store_ID = '${storeId}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`,
  );
  if (walk && walk.length > 0) {
    return walk[0];
  }
  // Create walk-in customer for this store
  await DataInsert(
    `tbl_customer`,
    `name, store_ID, reffstore, approved, delet_flage`,
    `'Walk in customer', '${storeId}', '${storeId}', 1, 0`,
    req ? req.hostname : "",
    req ? req.protocol : "",
  );
  walk = await DataFind(
    `SELECT * FROM tbl_customer WHERE store_ID = '${storeId}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`,
  );
  return walk && walk.length > 0 ? walk[0] : null;
}

async function getStoreScopedCustomers(storeId) {
  if (!storeId || storeId == "0" || storeId == "") return [];
  return await DataFind(`
    SELECT 
      tbl_customer.id, 
      tbl_customer.name, 
      tbl_customer.number, 
      tbl_customer.email, 
      tbl_customer.username, 
      tbl_store.name AS store_name
    FROM 
      tbl_customer
    LEFT JOIN 
      tbl_store ON tbl_customer.store_ID = tbl_store.id
    WHERE 
      tbl_customer.approved = 1 
      AND tbl_customer.delet_flage = 0 
      AND tbl_customer.store_ID = '${storeId}'
    ORDER BY (CASE WHEN tbl_customer.username IS NULL OR tbl_customer.username = '' OR tbl_customer.name LIKE '%Walk%in%' THEN 0 ELSE 1 END), tbl_customer.name ASC
  `);
}

router.get("/pos", auth, async (req, res) => {
  try {
    const customer = await DataFind(
      `SELECT COUNT(*) AS tot_cus FROM tbl_customer`,
    );
    if (customer[0].tot_cus == "0") {
      // const qury = `INSERT INTO tbl_customer (name,store_ID,reffstore,approved,delet_flage) VALUE ('Walk in customer','1', '1','1','0' )`;
      // await DataFind(qury);

      const customerInsert = await DataInsert(
        `tbl_customer`,
        `name, store_ID, reffstore, approved, delet_flage`,
        `'Walk in customer', '1', '1', '1', '0'`,
        req.hostname,
        req.protocol,
      );

      if (customerInsert == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/some_error_page");
      }
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    console.log(accessdata);
    console.log(req.user);

    var orderid = await idfororder();

    let login,
      service_list = [],
      storeList = [],
      ismulty = false,
      customerList = [],
      cartservice = [],
      cart,
      addonlist = [],
      isStaff = false,
      staffStoreId = null,
      staffStoreName = "",
      targetStoreId = 0,
      showStoreSelect = false,
      assignedStoreName = "",
      isMaster = false;

    if (
      accessdata.roll.rollType == "customer" &&
      accessdata.roll.pos.includes("read")
    ) {
      // customer login
      login = "customer";

      // 1. Fetch customer details
      const customerData = await DataFind(
        "SELECT id, name, number, email, store_ID, reffstore FROM tbl_customer WHERE id=" +
          id,
      );
      customerList =
        customerData.length > 0
          ? customerData
          : [{ id, name: "Customer", number: "", email: "" }];

      // 2. Resolve store: customer's store_ID -> reffstore -> token store -> fallback to first active store
      let resolvedStore =
        customerData.length > 0 &&
        customerData[0].store_ID &&
        String(customerData[0].store_ID) !== "0" &&
        String(customerData[0].store_ID).trim() !== ""
          ? String(customerData[0].store_ID)
          : customerData.length > 0 &&
              customerData[0].reffstore &&
              String(customerData[0].reffstore) !== "0" &&
              String(customerData[0].reffstore).trim() !== ""
            ? String(customerData[0].reffstore)
            : store && String(store) !== "0" && String(store).trim() !== ""
              ? String(store)
              : "";

      if (!resolvedStore) {
        const defaultStore = await DataFind(
          "SELECT id, name FROM tbl_store WHERE status=1 AND delete_flage=0 ORDER BY id ASC LIMIT 1",
        );
        resolvedStore =
          defaultStore.length > 0 ? String(defaultStore[0].id) : "1";
      }

      targetStoreId = resolvedStore;
      showStoreSelect = false;

      // 3. Fetch store details (name and tax)
      const storeDetails = await DataFind(
        `SELECT id, name, tax_percent FROM tbl_store WHERE id = '${targetStoreId}'`,
      );
      if (storeDetails.length > 0) {
        assignedStoreName = storeDetails[0].name;
      } else {
        assignedStoreName = "Main Store";
      }

      let taxValue =
        storeDetails.length > 0 ? storeDetails[0].tax_percent || 0 : 0;
      storeList = await DataFind(
        "SELECT id, name FROM tbl_store WHERE status=1 AND delete_flage=0",
      );

      // 4. Cart management and synchronization
      const cartdata = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
      );

      if (cartdata.length > 0) {
        const currentCartStore = String(cartdata[0].store_id || "0");
        if (currentCartStore !== String(targetStoreId)) {
          // Store mismatch: clear items belonging to different/unassigned store
          if (
            cartdata[0].service_list_id &&
            cartdata[0].service_list_id !== "0"
          ) {
            const oldIds = cartdata[0].service_list_id
              .split(",")
              .filter((x) => x && x !== "0")
              .join(",");
            if (oldIds) {
              await DataDelete(
                "tbl_cart_servicelist",
                `id IN (${oldIds})`,
                req.hostname,
                req.protocol,
              );
            }
          }
          await DataUpdate(
            `tbl_cart`,
            `order_id='${orderid}', store_id='${targetStoreId}', customer_id='${id}', tax='${taxValue}', service_list_id='0', sub_total=0, addon_id=0, addon_price=0, extra_discount=0, coupon_id=0, coupon_discount=0, tax_amount=0, gross_total=0, paid_amount=0, balance=0`,
            `created_by='${loginas},${id}'`,
            req.hostname,
            req.protocol,
          );
        } else {
          // Same store: update order_id, tax, and customer_id
          await DataUpdate(
            `tbl_cart`,
            `order_id='${orderid}', tax='${taxValue}', store_id='${targetStoreId}', customer_id='${id}'`,
            `created_by='${loginas},${id}'`,
            req.hostname,
            req.protocol,
          );
        }
      } else {
        // Fresh cart insert
        await DataInsert(
          `tbl_cart`,
          `created_by, store_id, customer_id, order_id, tax`,
          `'${loginas},${id}', '${targetStoreId}', ${id}, '${orderid}', '${taxValue}'`,
          req.hostname,
          req.protocol,
        );
      }

      // Re-fetch updated cart
      cart = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
      );

      // 5. Load services & addons for customer's store
      service_list = await DataFind(
        "SELECT * FROM tbl_services WHERE status=0 AND store_ID=" +
          targetStoreId +
          " ORDER BY sequence_no ASC, id ASC",
      );
      addonlist = await DataFind(
        "SELECT * FROM tbl_addons WHERE status=0 AND store_ID=" + targetStoreId,
      );

      if (
        cart.length > 0 &&
        cart[0].service_list_id &&
        cart[0].service_list_id !== "0"
      ) {
        cartservice = await DataFind(
          "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
            cart[0].service_list_id +
            "')",
        );
      } else {
        cartservice = [];
      }
    } else {
      // admin, store user, or staff login
      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
      );
      isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
      const assignedStore =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID) !== "0"
          ? String(adminData[0].store_ID)
          : store
            ? String(store)
            : "";
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
        !rolldetail[0].pos ||
        !rolldetail[0].pos.includes("read")
      ) {
        req.flash("error", "You Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }

      isMaster =
        rolldetail &&
        rolldetail.length > 0 &&
        rolldetail[0].rollType === "master" &&
        !isStaff &&
        (!adminData[0] ||
          !adminData[0].store_ID ||
          String(adminData[0].store_ID) === "0");

      const multiy = await DataFind(
        "SELECT type, customer_selection FROM tbl_master_shop",
      );
      ismulty = multiy[0].type == 1;
      storeList = await DataFind(
        "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
      );

      targetStoreId = 0;
      showStoreSelect = false;
      assignedStoreName = "";

      if (isMaster) {
        // Super Admin: Show store dropdown, start with unselected store ('0')
        showStoreSelect = true;
        login = "master";
        targetStoreId = 0;
        customerList = [];
        service_list = [];
        addonlist = [];
        cartservice = [];
      } else {
        // Store default user or Store Staff with POS permission: Lock to assignedStore!
        showStoreSelect = false;
        login = "store";
        targetStoreId = assignedStore;
        staffStoreId = assignedStore;

        if (assignedStore) {
          const sName = await DataFind(
            `SELECT name FROM tbl_store WHERE id = '${assignedStore}'`,
          );
          if (sName.length > 0) {
            assignedStoreName = sName[0].name;
            staffStoreName = sName[0].name;
          }
        }
      }

      let taxVal = 0;
      if (targetStoreId && targetStoreId != 0) {
        const taxData = await DataFind(
          "SELECT tax_percent FROM tbl_store WHERE id=" + targetStoreId,
        );
        taxVal = taxData.length > 0 ? taxData[0].tax_percent : 0;
      }

      const cartdata = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
      );
      if (cartdata.length > 0) {
        await DataUpdate(
          `tbl_cart`,
          `order_id='${orderid}', store_id='${targetStoreId}', tax=${taxVal}`,
          `created_by='${loginas},${id}'`,
          req.hostname,
          req.protocol,
        );
      } else {
        await DataInsert(
          `tbl_cart`,
          `created_by, order_id, store_id, tax, customer_id`,
          `'${loginas},${id}', '${orderid}', '${targetStoreId}', ${taxVal}, '0'`,
          req.hostname,
          req.protocol,
        );
      }

      cart = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
      );

      // For store users & staff: auto-assign the Walk-in customer of targetStoreId
      if (!isMaster && targetStoreId && targetStoreId != 0) {
        const walkinCustomer = await getOrCreateWalkInCustomer(
          targetStoreId,
          req,
        );
        if (walkinCustomer) {
          await DataUpdate(
            `tbl_cart`,
            `customer_id='${walkinCustomer.id}'`,
            `created_by='${loginas},${id}'`,
            req.hostname,
            req.protocol,
          );
          cart[0].customer_id = walkinCustomer.id;
        }

        customerList = await getStoreScopedCustomers(targetStoreId);
        service_list = await DataFind(
          "SELECT * FROM tbl_services WHERE status=0 AND store_ID=" +
            targetStoreId +
            " ORDER BY sequence_no ASC, id ASC",
        );
        addonlist = await DataFind(
          "SELECT * FROM tbl_addons WHERE status=0 AND store_ID=" +
            targetStoreId,
        );
        cartservice = await DataFind(
          "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
            cart[0].service_list_id +
            "')",
        );
      }
    }

    if (!cart || cart.length === 0) {
      return res.status(400).send("Cart not found");
    }

    orderid = cart[0].order_id;
    const splite_id = orderid.split(/[A-Za-z]/).join("");

    const readySchedule = await getEffectiveReadySchedule(targetStoreId);
    let storePrinterConfig = null;
    if (targetStoreId) {
      const spRows = await DataFind(`SELECT printing_server_url, invoice_printer_name, invoice_printer_format, tag_printer_name, tag_printer_format, silent_print_enabled, printer_auto_cut, printer_open_cash_drawer, printer_copies FROM tbl_store WHERE id = '${targetStoreId}' LIMIT 1`);
      if (spRows.length > 0) storePrinterConfig = spRows[0];
    }

    if (!cart[0].delivery_date || String(cart[0].delivery_date).slice(0, 10) === String(cart[0].order_date).slice(0, 10)) {
      const autoReady = calculateReadyDateTime(cart[0].order_date || new Date(), readySchedule);
      cart[0].delivery_date = autoReady.combinedTimestamp;
      await DataUpdate(
        `tbl_cart`,
        `delivery_date='${autoReady.combinedTimestamp}'`,
        `created_by='${loginas},${id}'`,
        req.hostname,
        req.protocol
      );
    }

    res.render("pos", {
      storePrinterConfig,
      login,
      storeList,
      service_list,
      ismulty,
      customerList,
      addonlist,
      cartservice,
      cart: cart[0],
      accessdata,
      readySchedule,
      isStaff: typeof isStaff !== "undefined" ? isStaff : false,
      staffStoreId: typeof staffStoreId !== "undefined" ? staffStoreId : null,
      staffStoreName:
        typeof staffStoreName !== "undefined" ? staffStoreName : "",
      showStoreSelect:
        typeof showStoreSelect !== "undefined" ? showStoreSelect : false,
      assignedStoreId: targetStoreId,
      assignedStoreName:
        typeof assignedStoreName !== "undefined" ? assignedStoreName : "",
      isMaster: typeof isMaster !== "undefined" ? isMaster : false,
      language: req.language_data,
      language_name: req.language_name,
      splite_id,
    });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
});

// Calculate Ready Schedule Endpoint
router.get("/calculate_ready_schedule", auth, async (req, res) => {
  try {
    const storeId = req.query.store_id || req.user.store || 0;
    const orderDate = req.query.order_date || new Date();
    const schedule = await getEffectiveReadySchedule(storeId);
    const result = calculateReadyDateTime(orderDate, schedule);
    return res.status(200).json({
      success: true,
      schedule,
      result,
    });
  } catch (error) {
    console.error("Error calculating ready schedule:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/edit/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    const order_date =
      await DataFind(`SELECT tbl_order.*, (select tbl_store.name from tbl_store where tbl_order.store_id = tbl_store.id) as store_name,
                                            (select tbl_customer.name from tbl_customer where tbl_order.customer_id = tbl_customer.id) as customer_name
                                            FROM tbl_order WHERE id = '${req.params.id}'`);
    if (!order_date || order_date.length === 0) {
      req.flash("error", "Order not found");
      return res.redirect("/order/list");
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    if (isStaff && staffStoreId && order_date[0].store_id != staffStoreId) {
      req.flash(
        "error",
        "You are not authorized to edit orders from other stores",
      );
      return res.redirect("/order/list");
    }

    order_date[0].addon_data = order_date[0].addon_data || "";

    let service_list = await DataFind(
      `SELECT * FROM tbl_services WHERE (store_ID = '${order_date[0].store_id}' OR store_id = 0 OR store_id IS NULL) AND status=0 ORDER BY sequence_no ASC, id ASC`,
    );
    if (!service_list || service_list.length === 0) {
      service_list = await DataFind(`SELECT * FROM tbl_services WHERE status=0 ORDER BY sequence_no ASC, id ASC`);
    }

    var cartservice = [];
    if (
      order_date[0].service_list &&
      order_date[0].service_list.trim().length > 0
    ) {
      cartservice = await DataFind(
        "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
          order_date[0].service_list +
          "')",
      );
    }

    var addonlist = await DataFind(
      `SELECT * FROM tbl_addons WHERE status = 0 AND (store_ID='${order_date[0].store_id}' OR store_id = 0 OR store_id IS NULL)`,
    );
    if (!addonlist || addonlist.length === 0) {
      addonlist = await DataFind(`SELECT * FROM tbl_addons WHERE status = 0`);
    }

    const readySchedule = await getEffectiveReadySchedule(order_date[0].store_id);

    res.render("pos_edit", {
      accessdata,
      order_date,
      readySchedule,
      service_list: service_list || [],
      cartservice: cartservice || [],
      addonlist: addonlist || [],
      roll,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log("Error in /edit/:id:", error);
    res.redirect("/order/list");
  }
});

// when store change
// service list from store id
router.get("/servicelist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster =
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] ||
        !adminData[0].store_ID ||
        String(adminData[0].store_ID) === "0");

    let storeid = req.params.id;
    if (!isMaster && assignedStore) {
      storeid = assignedStore;
    }
    const safeStoreId = parseInt(storeid) || 0;
    var service_list = await DataFind(
      " SELECT * FROM tbl_services WHERE status=0 AND store_ID=" +
        safeStoreId +
        " ORDER BY sequence_no ASC, id ASC",
    );
    res.status(200).json({ service_list });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// get Addon on store change and store id in cart
router.get("/addonlist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster =
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] ||
        !adminData[0].store_ID ||
        String(adminData[0].store_ID) === "0");

    let storeid = req.params.id;
    if (!isMaster && assignedStore) {
      storeid = assignedStore;
    }
    const safeStoreId = parseInt(storeid) || 0;

    var addon_list = await DataFind(
      " SELECT * FROM tbl_addons WHERE status=0 AND store_ID=" +
        safeStoreId +
        "",
    );

    var tax = await DataFind(
      "SELECT tax_percent FROM tbl_store WHERE id=" + safeStoreId + "",
    );
    const taxVal = tax.length > 0 ? tax[0].tax_percent : 0;

    let defaultCustSql = "";
    if (!isMaster) {
      const walkinCustomer = await getOrCreateWalkInCustomer(safeStoreId, req);
      defaultCustSql = walkinCustomer
        ? `, customer_id='${walkinCustomer.id}'`
        : "";
    } else {
      defaultCustSql = `, customer_id='0'`;
    }

    await DataUpdate(
      `tbl_cart`,
      `store_id=${safeStoreId}, tax=${taxVal}${defaultCustSql}`,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );

    res.status(200).json({ addon_list, cart: cart[0] });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// customer list
router.get("/customerlist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);
    const isMaster =
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] ||
        !adminData[0].store_ID ||
        String(adminData[0].store_ID) === "0");

    let storeid = req.params.id;
    if (!isMaster && assignedStore) {
      storeid = assignedStore;
    }
    if (!storeid || storeid === "null" || storeid === "0") {
      storeid = store;
    }
    const safeStoreId = parseInt(storeid) || 0;

    const customerList = await getStoreScopedCustomers(safeStoreId);
    let defaultCustomerId = 0;

    if (!isMaster) {
      const walkinCustomer = await getOrCreateWalkInCustomer(safeStoreId, req);
      defaultCustomerId = walkinCustomer
        ? walkinCustomer.id
        : customerList.length > 0
          ? customerList[0].id
          : 0;

      if (defaultCustomerId) {
        await DataUpdate(
          `tbl_cart`,
          `customer_id='${defaultCustomerId}', store_id='${safeStoreId}'`,
          `created_by='${loginas},${id}'`,
          req.hostname,
          req.protocol,
        );
      }
    } else {
      // For Admin: DO NOT auto-select customer. Customer remains unselected (0) until Admin explicitly selects one.
      await DataUpdate(
        `tbl_cart`,
        `customer_id='0', store_id='${safeStoreId}'`,
        `created_by='${loginas},${id}'`,
        req.hostname,
        req.protocol,
      );
    }

    res.status(200).json({ customerList, defaultCustomerId, isStaff });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// add service to cart
router.post("/addservicelist", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    console.log(11111, req.body);
    const serviceid = req.body.serviceid.split(",")[0];
    const rawServiceName = req.body.serviceid.split(",")[1] || "";
    const serviceimage = req.body.serviceid.split(",")[2] || "";
    let servicePieces = parseInt(req.body.serviceid.split(",")[3]);
    if (!servicePieces || isNaN(servicePieces) || servicePieces < 1) {
      const svc = await DataFind(`SELECT no_of_items FROM tbl_services WHERE id = ${parseInt(serviceid) || 0}`);
      servicePieces = (svc && svc.length > 0 && svc[0].no_of_items) ? parseInt(svc[0].no_of_items) : 1;
    }

    const servicetypeid = req.body.servicetype.split(",")[0];
    const servicetypeprice = req.body.servicetype.split(",")[1];
    const rawServiceTypeName = req.body.servicetype.split(",")[2] || "";

    const safeServiceName = rawServiceName.replace(/'/g, "''");
    const safeServiceTypeName = rawServiceTypeName.replace(/'/g, "''");

    const servicelist = await DataInsert(
      "tbl_cart_servicelist",
      "service_id, service_type_id, service_type_price, service_quntity, service_color, service_name, service_type_name, service_img, no_of_items",
      `${serviceid}, ${servicetypeid}, ${servicetypeprice}, 1, '#000000', '${safeServiceName}', '${safeServiceTypeName}', '${serviceimage}', ${servicePieces}`,
      req.hostname,
      req.protocol,
    );

    if (servicelist === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET service_list_id=CONCAT(service_list_id,'," +
    //     servicelist.insertId +
    //     "'),sub_total= ROUND(sub_total + " +
    //     servicetypeprice +
    //     ",2), tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax/ 100),2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const cartupdate = await DataUpdate(
      `tbl_cart`,
      `
    service_list_id = CONCAT(service_list_id, ',${servicelist.insertId}'),
    sub_total = ROUND(sub_total + ${servicetypeprice}, 2),
    tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax / 100), 2),
    gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
    balance = ROUND(gross_total - paid_amount, 2)
  `,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );
    console.log("cartservice", cartservice);

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
});

// edit service to cart
router.post("/editservicelist", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const serviceid = req.body.serviceid.split(",")[0];
    const rawServiceName = req.body.serviceid.split(",")[1] || "";
    const serviceimage = req.body.serviceid.split(",")[2] || "";
    let servicePieces = parseInt(req.body.serviceid.split(",")[3]);
    if (!servicePieces || isNaN(servicePieces) || servicePieces < 1) {
      const svc = await DataFind(`SELECT no_of_items FROM tbl_services WHERE id = ${parseInt(serviceid) || 0}`);
      servicePieces = (svc && svc.length > 0 && svc[0].no_of_items) ? parseInt(svc[0].no_of_items) : 1;
    }

    const servicetypeid = req.body.servicetype.split(",")[0];
    const servicetypeprice = req.body.servicetype.split(",")[1];
    const rawServiceTypeName = req.body.servicetype.split(",")[2] || "";

    const safeServiceName = rawServiceName.replace(/'/g, "''");
    const safeServiceTypeName = rawServiceTypeName.replace(/'/g, "''");

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );

    const servicelist = await DataInsert(
      `tbl_cart_servicelist`,
      `service_id,service_type_id,service_type_price,service_quntity,service_color,service_name,service_type_name,service_img,no_of_items`,
      `${serviceid},${servicetypeid},${servicetypeprice},1,'#000000','${safeServiceName}','${safeServiceTypeName}','${serviceimage}',${servicePieces}`,
      req.hostname,
      req.protocol,
    );

    if (servicelist == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );
    // await DataFind(
    //   "UPDATE tbl_order SET service_list = CONCAT(service_list,'," +
    //     servicelist.insertId +
    //     "'),sub_total= ROUND(sub_total + " +
    //     servicetypeprice +
    //     ",2), tax_amount =ROUND((sub_total + addon_price - coupon_discount) * (tax/ 100),2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2) WHERE id = '" +
    //     old_order_date[0].id +
    //     "'"
    // );

    let currentList = (old_order_date[0].service_list || "")
      .toString()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    currentList.push(servicelist.insertId.toString());
    const updatedListStr = currentList.join(",");

    let updateOrder = await DataUpdate(
      `tbl_order`,
      `
    service_list = '${updatedListStr}',
    sub_total = ROUND(sub_total + ${servicetypeprice}, 2),
    tax_amount = ROUND((sub_total + addon_price - coupon_discount) * (tax / 100), 2),
    gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
    balance_amount = ROUND(gross_total - paid_amount, 2),
    master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)
  `,
      `id='${old_order_date[0].id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateOrder == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET service_list_id=CONCAT(service_list_id,',"+servicelist.insertId+"'),sub_total= ROUND(sub_total + "+servicetypeprice+",2), tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax/ 100),2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='"+loginas+','+id+"'");

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );
    console.log("cartservice", cartservice);

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// edit remove service to cart
router.post("/edit_removeservicelist", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    console.log(99999, req.body);

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE ID=${req.body.service_id} `,
    );
    console.log(1111, service);

    const diff =
      parseFloat(service[0].service_type_price) *
      parseFloat(service[0].service_quntity);
    console.log("diff", diff);

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = (
      parseFloat(old_order_date[0].sub_total) - parseFloat(diff)
    ).toFixed(2);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(old_order_date[0].coupon_discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(old_order_date[0].coupon_discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);

    let currentList = (old_order_date[0].service_list || "")
      .toString()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    currentList = currentList.filter(
      (sId) => sId != req.body.service_id.toString(),
    );
    const updatedListStr = currentList.join(",");

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    const orderupdate = await DataUpdate(
      `tbl_order`,
      `
        coupon_id = '0',
        coupon_discount = '0',
        service_list = '${updatedListStr}',
        sub_total = ROUND(sub_total - ${diff}, 2),
        tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
        gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
        balance_amount = ROUND(gross_total - paid_amount, 2),
        master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)
      `,
      `id='${req.body.order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderupdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET service_list_id=REPLACE(service_list_id,',"+serviceid+"',''),sub_total= ROUND(sub_total - "+ diff+",2), tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total =ROUND( sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance =ROUND( gross_total - paid_amount,2) WHERE created_by='"+loginas+','+id+"'");

    // const deletservice = await DataFind(
    //   "DELETE FROM tbl_cart_servicelist WHERE id=" + req.body.service_id + ""
    // );

    if (
      (await DataDelete(
        `tbl_cart_servicelist`,
        `id = '${req.body.service_id}'`,
        req.hostname,
        req.protocol,
      )) == -1
    ) {
      req.flash("error", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    console.log(1111, "order_date", order_date);
    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// remove service to cart
router.get("/removeservicelist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const serviceid = req.params.id;

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE ID=${serviceid} `,
    );

    const diff =
      parseFloat(service[0].service_type_price) *
      parseFloat(service[0].service_quntity);

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET coupon_id='0', coupon_discount='0', service_list_id=REPLACE(service_list_id,'," +
    //     serviceid +
    //     "',''),sub_total= ROUND(sub_total - " +
    //     diff +
    //     ",2), tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total =ROUND( sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance =ROUND( gross_total - paid_amount,2) WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const cartupdate = await DataUpdate(
      `tbl_cart`,
      `
    coupon_id = '0',
    coupon_discount = '0',
    service_list_id = REPLACE(service_list_id, ',${serviceid}', ''),
    sub_total = ROUND(sub_total - ${diff}, 2),
    tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
    gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
    balance = ROUND(gross_total - paid_amount, 2)
  `,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const deletservice = await DataFind(
    //   "DELETE FROM tbl_cart_servicelist WHERE id=" + serviceid + ""
    // );

    if (
      (await DataDelete(
        `tbl_cart_servicelist`,
        `id = '${serviceid}'`,
        req.hostname,
        req.protocol,
      )) == -1
    ) {
      req.flash("error", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// get service type id from service
router.get("/getservicetype/:id", auth, async (req, res) => {
  try {
    const accessdata = await access(req.user);
    const serviceId = parseInt(req.params.id);
    if (!serviceId) {
      return res.status(200).json({ data: [], serviceid: "", accessdata });
    }
    const ServiceType = await DataFind(
      "SELECT id, services_type_id, services_type_price, services_type_sequence, services_type_items, services_type_ready_time, name, image, no_of_items FROM tbl_services WHERE id = " +
        serviceId,
    );
    if (!ServiceType || ServiceType.length === 0) {
      return res.status(200).json({ data: [], serviceid: "", accessdata });
    }

    const s = ServiceType[0];
    const prices = (s.services_type_price || "")
      .toString()
      .split(",")
      .map((p) => p.trim());
    const types = (s.services_type_id || "")
      .toString()
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    const sequences = (s.services_type_sequence || "")
      .toString()
      .split(",")
      .map((sq) => sq.trim());
    const itemsList = (s.services_type_items || "")
      .toString()
      .split(",")
      .map((it) => it.trim());
    const readyTimes = (s.services_type_ready_time || "")
      .toString()
      .split(",")
      .map((rt) => rt.trim());
    const service =
      s.id + "," + (s.name || "") + "," + (s.image || "default.png") + "," + (s.no_of_items || 1);

    const typlist = [];
    for (let i = 0; i < types.length; i++) {
      const typeId = types[i];
      if (!typeId) continue;
      const stResult = await DataFind(
        "SELECT services_type FROM tbl_services_type WHERE id = " + typeId,
      );
      if (stResult && stResult.length > 0) {
        typlist.push({
          id: typeId,
          servicetype: stResult[0].services_type,
          price: prices[i] !== undefined && prices[i] !== "" ? prices[i] : "0.00",
          sequence: parseInt(sequences[i]) || (i + 1),
          items: parseInt(itemsList[i]) || 1,
          ready_time: parseInt(readyTimes[i]) || 1440,
        });
      }
    }

    typlist.sort((a, b) => a.sequence - b.sequence);

    return res
      .status(200)
      .json({ data: typlist, serviceid: service, accessdata });
  } catch (error) {
    console.error("Error in /getservicetype/:id:", error);
    return res
      .status(500)
      .json({ error: error.message, data: [], serviceid: "" });
  }
});

// customer change save in cart
router.get("/newcustomerid/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var customerid = req.params.id;
    // console.log("customerid",customerid);

    // var cart = await DataFind(
    //   "UPDATE tbl_cart SET customer_id=" +
    //     customerid +
    //     " WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    let cart = await DataUpdate(
      `tbl_cart`,
      `customer_id=${customerid}`,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cart == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200 });
  } catch (error) {
    console.log(error);
  }
});

//  POS Service Color change
router.post("/color", auth, async (req, res) => {
  try {
    var { id, color } = req.body;

    // var cart = await DataFind(
    //   "UPDATE tbl_cart_servicelist SET service_color='" +
    //     color +
    //     "' WHERE id=" +
    //     id +
    //     ""
    // );

    let cart = await DataUpdate(
      `tbl_cart_servicelist`,
      `service_color='${color}'`,
      `id=${id}`,
      req.hostname,
      req.protocol,
    );

    if (cart == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200 });
  } catch (error) {
    console.log(error);
  }
});

//  POS Date change
router.post("/date", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var { date, delivery_date, delivery_time } = req.body;

    let updateFields = `order_date='${date}'`;
    if (delivery_date) {
      let fullDelivery = formatMySQLDateTime(delivery_date, delivery_time || "16:00:00");
      updateFields += `, delivery_date='${fullDelivery}'`;
    } else {
      const cartCheck = await DataFind(
        `SELECT delivery_date FROM tbl_cart WHERE created_by='${loginas},${id}'`,
      );
      if (cartCheck && cartCheck.length > 0 && cartCheck[0].delivery_date) {
        let currentDel = new Date(cartCheck[0].delivery_date)
          .toISOString()
          .slice(0, 10);
        if (currentDel < date) {
          updateFields += `, delivery_date='${date} 16:00:00'`;
        }
      } else {
        updateFields += `, delivery_date='${date} 16:00:00'`;
      }
    }

    let cart = await DataUpdate(
      `tbl_cart`,
      updateFields,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cart == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200, date, delivery_date });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

//  POS Delivery Date change
router.post("/delivery_date", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var { delivery_date, delivery_time } = req.body;

    let fullDelivery = formatMySQLDateTime(delivery_date, delivery_time || "16:00:00");

    let cart = await DataUpdate(
      `tbl_cart`,
      `delivery_date='${fullDelivery}'`,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cart == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200, delivery_date: fullDelivery });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

//  POS Edit Order Date change
router.post("/edit_date", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const { date, delivery_date, delivery_time, order_id } = req.body;

    let updateFields = `order_date='${date}'`;
    if (delivery_date) {
      let fullDelivery = formatMySQLDateTime(delivery_date, delivery_time || "16:00:00");
      updateFields += `, delivery_date='${fullDelivery}'`;
    } else {
      const orderCheck = await DataFind(
        `SELECT delivery_date FROM tbl_order WHERE id='${order_id}'`,
      );
      if (orderCheck && orderCheck.length > 0 && orderCheck[0].delivery_date) {
        let currentDel = new Date(orderCheck[0].delivery_date)
          .toISOString()
          .slice(0, 10);
        if (currentDel < date) {
          updateFields += `, delivery_date='${date} 16:00:00'`;
        }
      }
    }

    let orderUpdate = await DataUpdate(
      `tbl_order`,
      updateFields,
      `id='${order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderUpdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200, date, delivery_date });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

//  POS Edit Delivery Date change
router.post("/edit_delivery_date", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const { delivery_date, delivery_time, order_id } = req.body;

    let fullDelivery = formatMySQLDateTime(delivery_date, delivery_time || "16:00:00");

    let orderUpdate = await DataUpdate(
      `tbl_order`,
      `delivery_date='${fullDelivery}'`,
      `id='${order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderUpdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    res.status(200).json({ status: 200, delivery_date: fullDelivery });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
});

//  POS Clear cart
router.get("/clearcart", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    var orderid = await idfororder();

    const cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    console.log(cart);

    var tax = await DataFind(
      "SELECT tax_percent FROM tbl_store WHERE id=" + cart[0].store_id + "",
    );
    if (cart.length > 0) {
      const servicelist = cart[0].service_list_id.split(",");
      await Promise.all(
        servicelist.map(async (data, i) => {
          // await DataFind(
          //   "DELETE FROM tbl_cart_servicelist WHERE id=" + data + ""
          // );

          if (
            (await DataDelete(
              `tbl_cart_servicelist`,
              `id = '${data}'`,
              req.hostname,
              req.protocol,
            )) == -1
          ) {
            req.flash("error", process.env.dataerror);
            return res.redirect("/valid_license");
          }
        }),
      );
      // await DataFind(`UPDATE tbl_cart SET order_date=CURRENT_TIMESTAMP,service_list_id=0,order_id=0,addon_id=0,addon_price=0,delivery_date=CURRENT_TIMESTAMP,extra_discount=0,
      //                       coupon_id=0,coupon_discount=0,tax_amount=0,sub_total=0,gross_total=0,paid_amount=0,payment_type=0, order_id='${orderid}',
      //                       balance=0,notes='', tax=${tax[0].tax_percent} WHERE created_by='${loginas},${id}'`);

      let cartReset = await DataUpdate(
        `tbl_cart`,
        `
    order_date = CURRENT_TIMESTAMP,
    service_list_id = 0,
    order_id = '${orderid}',
    addon_id = 0,
    addon_price = 0,
    delivery_date = CURRENT_TIMESTAMP,
    extra_discount = 0,
    coupon_id = 0,
    coupon_discount = 0,
    tax_amount = 0,
    sub_total = 0,
    gross_total = 0,
    paid_amount = 0,
    payment_type = 0,
    balance = 0,
    notes = '',
    tax = ${tax[0].tax_percent}
  `,
        `created_by='${loginas},${id}'`,
        req.hostname,
        req.protocol,
      );

      if (cartReset == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/valid_license");
      }

      var cartdata = await DataFind(
        " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
      );
      var cartservice = await DataFind(
        "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
          cart[0].service_list_id +
          "')",
      );

      res.status(200).json({ cart: cartdata[0], cartservice, loginas });
    }
  } catch (error) {
    console.log(error);
  }
});

// change service amount
router.post("/changeamount", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const { id: serviceid, price } = req.body;

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE id=${serviceid}`,
    );

    const amount_diff =
      parseFloat(price) * parseFloat(service[0].service_quntity) -
      parseFloat(service[0].service_type_price) *
        parseFloat(service[0].service_quntity);
    // const updateservice = await DataFind(
    //   "UPDATE tbl_cart_servicelist SET service_type_price=" +
    //     price +
    //     " WHERE id=" +
    //     serviceid +
    //     ""
    // );
    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET  coupon_id='0', coupon_discount='0', sub_total= ROUND(sub_total + " +
    //     amount_diff +
    //     ",2) , tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    let updateservice = await DataUpdate(
      `tbl_cart_servicelist`,
      `service_type_price=${price}`,
      `id=${serviceid}`,
      req.hostname,
      req.protocol,
    );

    if (updateservice == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    let cartupdate = await DataUpdate(
      `tbl_cart`,
      `
                         coupon_id='0',
                         coupon_discount='0',
                         sub_total = ROUND(sub_total + ${amount_diff}, 2),
                         tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
                         gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
                         balance = ROUND(gross_total - paid_amount, 2)
                       `,
      `created_by='${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// change service amount
router.post("/edit_changeamount", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const { id: serviceid, price, order_id } = req.body;

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE id=${serviceid}`,
    );
    console.log("service", service);

    const amount_diff =
      parseFloat(price) * parseFloat(service[0].service_quntity) -
      parseFloat(service[0].service_type_price) *
        parseFloat(service[0].service_quntity);

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = (
      parseFloat(old_order_date[0].sub_total) + parseFloat(amount_diff)
    ).toFixed(2);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(old_order_date[0].coupon_discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(old_order_date[0].coupon_discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);
    // allow price modification freely

    // const updateservice = await DataFind(
    //   "UPDATE tbl_cart_servicelist SET service_type_price=" +
    //     price +
    //     " WHERE id=" +
    //     serviceid +
    //     ""
    // );

    const updateservice = await DataUpdate(
      `tbl_cart_servicelist`,
      `service_type_price = ${price}`,
      `id = ${serviceid}`,
      req.hostname,
      req.protocol,
    );

    if (updateservice === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );
    // await DataFind(
    //   "UPDATE tbl_order  SET coupon_id='0', coupon_discount='0', sub_total= ROUND(sub_total + " +
    //     amount_diff +
    //     ",2) , tax_amount =ROUND((sub_total + addon_price - coupon_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2)  WHERE id = '" +
    //     order_id +
    //     "'"
    // );

    const updateOrder = await DataUpdate(
      `tbl_order`,
      ` coupon_id = '0',
            coupon_discount = '0',
            sub_total = ROUND(sub_total + ${amount_diff}, 2),
            tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
            gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
            balance_amount = ROUND(gross_total - paid_amount, 2),
            master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)
          `,
      `id = '${order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateOrder === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET sub_total= ROUND(sub_total + "+amount_diff+",2) , tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='"+loginas+','+id+"'");

    const order_date = await DataFind(
      " SELECT * FROM tbl_order WHERE id = '" + order_id + "'",
    );
    console.log("order_date", order_date);
    const cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// change service Quntity
router.post("/edit_changequntity", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const { id: serviceid, qty, order_id } = req.body;

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE id=${serviceid}`,
    );
    const amount_diff =
      parseFloat(service[0].service_type_price) * parseFloat(qty) -
      parseFloat(service[0].service_type_price) *
        parseFloat(service[0].service_quntity);

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = (
      parseFloat(old_order_date[0].sub_total) + parseFloat(amount_diff)
    ).toFixed(2);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(old_order_date[0].coupon_discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(old_order_date[0].coupon_discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);
    // allow quantity modification freely

    // const updateservice = await DataFind(
    //   "UPDATE tbl_cart_servicelist SET service_quntity=" +
    //     qty +
    //     " WHERE id=" +
    //     serviceid +
    //     ""
    // );

    const updateServiceQty = await DataUpdate(
      `tbl_cart_servicelist`,
      `service_quntity = ${qty}`,
      `id = ${serviceid}`,
      req.hostname,
      req.protocol,
    );

    if (updateServiceQty === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    // await DataFind(
    //   "UPDATE tbl_order SET coupon_id='0',coupon_discount='0', sub_total= ROUND(sub_total + " +
    //     amount_diff +
    //     ",2) , tax_amount =ROUND((sub_total + addon_price - coupon_discount) * (tax / 100),2) , gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2) , balance_amount = ROUND(gross_total - paid_amount,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2) WHERE id = '" +
    //     order_id +
    //     "'"
    // );

    const updateOrder = await DataUpdate(
      `tbl_order`,
      `
    coupon_id = '0',
    coupon_discount = '0',
    sub_total = ROUND(sub_total + ${amount_diff}, 2),
    tax_amount = ROUND((sub_total + addon_price - coupon_discount) * (tax / 100), 2),
    gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
    balance_amount = ROUND(gross_total - paid_amount, 2),
    master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)
  `,
      `id = '${order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateOrder === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET sub_total= ROUND(sub_total + "+amount_diff+",2) , tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax / 100),2) , gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2) , balance = ROUND(gross_total - paid_amount,2)   WHERE created_by='"+loginas+','+id+"'");

    const order_date = await DataFind(
      " SELECT * FROM tbl_order WHERE id = '" + order_id + "'",
    );
    const cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// change service Quntity
router.post("/changequntity", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const { id: serviceid, qty } = req.body;

    const service = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE id=${serviceid}`,
    );
    const amount_diff =
      parseFloat(service[0].service_type_price) * parseFloat(qty) -
      parseFloat(service[0].service_type_price) *
        parseFloat(service[0].service_quntity);

    // const updateservice = await DataFind(
    //   "UPDATE tbl_cart_servicelist SET service_quntity=" +
    //     qty +
    //     " WHERE id=" +
    //     serviceid +
    //     ""
    // );

    const updateservice = await DataUpdate(
      "tbl_cart_servicelist",
      `service_quntity = ${qty}`,
      `id = ${serviceid}`,
      req.hostname,
      req.protocol,
    );

    if (updateservice === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET  coupon_id='0', coupon_discount='0',sub_total= ROUND(sub_total + " +
    //     amount_diff +
    //     ",2) , tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax / 100),2) , gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2) , balance = ROUND(gross_total - paid_amount,2)   WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const cartupdate = await DataUpdate(
      "tbl_cart",
      `coupon_id = '0', 
        coupon_discount = '0',
        sub_total = ROUND(sub_total + ${amount_diff}, 2),
        tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (tax / 100), 2),
        gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
        balance = ROUND(gross_total - paid_amount, 2)`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// Add Addons's to cart
router.post("/addonsadd", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var addon = req.body.addon;
    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );

    addon
      ? Array.isArray(addon)
        ? (addon = addon.join(","))
        : addon
      : (addon = "0");
    const newaddonarry = addon.split(",");
    var price = 0;
    await Promise.all(
      newaddonarry.map(async (data, i) => {
        var x = await DataFind(
          "SELECT price FROM tbl_addons WHERE id=" + data + "",
        );
        if (x.length > 0) {
          return (price += x[0].price);
        }
      }),
    );

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET addon_id='" +
    //     addon +
    //     "', addon_price=" +
    //     price +
    //     ", tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const cartupdate = await DataUpdate(
      "tbl_cart",
      `addon_id = '${addon}',
   addon_price = ${price},
   tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance = ROUND(gross_total - paid_amount, 2)`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// Add Addons's to cart
router.post("/edit_onsadd", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    var addon = req.body.addon;
    // var order_date = await DataFind(`SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`)
    // console.log('order_date', order_date);
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");

    addon
      ? Array.isArray(addon)
        ? (addon = addon.join(","))
        : addon
      : (addon = "0");
    const newaddonarry = addon.split(",");
    var price = 0;
    await Promise.all(
      newaddonarry.map(async (data, i) => {
        var x = await DataFind(
          "SELECT price FROM tbl_addons WHERE id=" + data + "",
        );
        if (x.length > 0) {
          return (price += x[0].price);
        }
      }),
    );
    console.log(price);

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = parseFloat(old_order_date[0].sub_total);
    console.log("sub_total", sub_total);

    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(price) -
        parseFloat(old_order_date[0].coupon_discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);

    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(price) -
      parseFloat(old_order_date[0].coupon_discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);

    if (gross_total < old_order_date[0].paid_amount) {
      req.flash("error", "gross_total Less-than paid_amount");
      return res.json(400);
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    // await DataFind(
    //   "UPDATE tbl_order SET addon_data='" +
    //     addon +
    //     "', addon_price=" +
    //     price +
    //     ", tax_amount =ROUND((sub_total + addon_price - coupon_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2)  WHERE id='" +
    //     req.body.order_id +
    //     "'"
    // );

    const updateOrder = await DataUpdate(
      "tbl_order",
      `addon_data = '${addon}',
   addon_price = ${price},
   tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance_amount = ROUND(gross_total - paid_amount, 2),
   master_comission = ROUND((gross_total * '${store_data[0].shop_commission}') / 100, 2)`,
      `id = '${req.body.order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateOrder === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET addon_id='"+addon+"', addon_price="+price+", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='"+loginas+','+id+"'");

    var order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("order_date", order_date);
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// coupon list on ajax call
router.get("/couponlist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    console.log("loginas", loginas);
    const accessdata = await access(req.user);

    const couid = req.params.id;
    const customer = await DataFind(
      "SELECT store_ID From tbl_customer WHERE id=" + couid + "",
    );
    console.log("customer", customer);
    var customer_order = await DataFind(
      "SELECT * From tbl_order WHERE customer_id=" + couid + "",
    );

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );

    console.log("customer_order", customer_order);

    if (customer_order.length > 0) {
      if (
        customer[0].store_ID == "" ||
        accessdata.masterstore.customer_selection == "1"
      ) {
        var coupons = await DataFind(
          "select * from tbl_coupon where start_date <= date(now()) AND end_date >= date(now()) AND status = 0 AND find_in_set('" +
            cart[0].store_id +
            "',store_list_id) AND coupon_type = 1",
        );
      } else {
        var coupons = await DataFind(
          "select * from tbl_coupon where start_date <= date(now()) AND end_date >= date(now()) AND status = 0 AND find_in_set('" +
            customer[0].store_ID +
            "',store_list_id) AND coupon_type = 1",
        );
      }

      var usedcoupon = customer_order.map((data) => data.coupon_id);
      var couponlist = coupons.filter((data, i) => {
        if (
          data.limit_forsame_user >
          usedcoupon.filter((i) => i == data.id).length
        ) {
          return true;
        }
      });
    } else {
      if (
        customer[0].store_ID == "" ||
        accessdata.masterstore.customer_selection == "1"
      ) {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            cart[0].store_id +
            "',store_list_id)",
        );
      } else {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            customer[0].store_ID +
            "',store_list_id)",
        );
      }

      // var couponlist = await DataFind(
      //   "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
      //     customer[0].store_ID +
      //     "',store_list_id)"
      // );
    }

    console.log("cart", cart);
    console.log("couponlist", couponlist);
    res.status(200).json({ cart: cart[0], couponlist });
  } catch (error) {
    console.log(error);
  }
});

// coupon list on ajax call
router.post("/edit_couponlist", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    console.log("loginas", loginas);
    const couid = req.body.customer;
    console.log("couid", couid);

    const accessdata = await access(req.user);

    const customer = await DataFind(
      "SELECT store_ID From tbl_customer WHERE id=" + couid + "",
    );
    console.log("customer", customer);
    var customer_order = await DataFind(
      "SELECT * From tbl_order WHERE customer_id=" + couid + "",
    );

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );

    console.log("order_date", order_date);

    console.log("customer_order", customer_order);
    if (customer_order.length > 0) {
      if (
        customer[0].store_ID == "" ||
        accessdata.masterstore.customer_selection == "1"
      ) {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            order_date[0].store_id +
            "',store_list_id) AND coupon_type=1",
        );
        console.log("couponlist1", couponlist);
      } else {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            customer[0].store_ID +
            "',store_list_id) AND coupon_type=1",
        );
      }

      var usedcoupon = customer_order.map((data) => data.coupon_id);

      console.log("usedcoupon", usedcoupon);
      console.log("couponlist", couponlist);
    } else {
      if (
        customer[0].store_ID == "" ||
        accessdata.masterstore.customer_selection == "1"
      ) {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            order_date[0].store_id +
            "',store_list_id)",
        );
      } else {
        var couponlist = await DataFind(
          "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
            customer[0].store_ID +
            "',store_list_id)",
        );
      }
    }

    console.log("couponlist", couponlist);
    console.log("order_date", order_date);
    res.status(200).json({ order_date: order_date[0], couponlist });
  } catch (error) {
    console.log(error);
  }
});

// Add coupons to cart
router.get("/couponadd/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponid = req.params.id;

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var coupon = await DataFind(
      "select * from tbl_coupon where id=" + couponid + "",
    );

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET coupon_id='" +
    //     couponid +
    //     "', coupon_discount=" +
    //     coupon[0].discount +
    //     ", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount ,2) WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const updateCart = await DataUpdate(
      "tbl_cart",
      `coupon_id = '${couponid}',
   coupon_discount = ${coupon[0].discount},
   tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance = ROUND(gross_total - paid_amount, 2)`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateCart === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

router.get("/removecoupon/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponid = req.params.id;

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    // var coupon = await DataFind(
    //   "select * from tbl_coupon where id=" + couponid + ""
    // );

    //     const cartupdate = await DataFind(`
    //   UPDATE tbl_cart
    //   SET
    //     coupon_id = '${"0"}',
    //     coupon_discount = ${"0"},
    //     tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
    //     gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
    //     balance = ROUND(gross_total - paid_amount, 2)
    //   WHERE
    //     created_by = '${loginas},${id}'
    // `);

    const cartupdate = await DataUpdate(
      "tbl_cart",
      `coupon_id = '0',
   coupon_discount = 0,
   tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance = ROUND(gross_total - paid_amount, 2)`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// Add coupons to cart
router.post("/edit_couponadd", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponid = req.body.couponid;
    console.log(1111, req.body);

    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");

    var coupon = await DataFind(
      "select * from tbl_coupon where id=" + couponid + "",
    );

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = parseFloat(old_order_date[0].sub_total);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(coupon[0].discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(coupon[0].discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);

    if (gross_total < old_order_date[0].paid_amount) {
      req.flash("error", "gross_total Less-than paid_amount");
      return res.json(400);
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    // await DataFind(
    //   "UPDATE tbl_order SET coupon_id='" +
    //     couponid +
    //     "', coupon_discount=" +
    //     coupon[0].discount +
    //     ", tax_amount =ROUND((sub_total + addon_price - coupon_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount ,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2) WHERE id='" +
    //     req.body.order_id +
    //     "'"
    // );

    const orderUpdate = await DataUpdate(
      "tbl_order",
      `coupon_id = '${couponid}',
     coupon_discount = ${coupon[0].discount},
     tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
     gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
     balance_amount = ROUND(gross_total - paid_amount, 2),
     master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)`,
      `id = '${req.body.order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderUpdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET coupon_id='"+couponid+"', coupon_discount="+coupon[0].discount+", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount ,2) WHERE created_by='"+loginas+','+id+"'");

    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

router.post("/edit_couponremove/", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponid = req.body.couponid;
    console.log(1111, req.body);

    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");

    var coupon = await DataFind(
      "select * from tbl_coupon where id=" + couponid + "",
    );

    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("old_order_date", old_order_date);

    const sub_total = parseFloat(old_order_date[0].sub_total);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(coupon[0].discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(coupon[0].discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);

    if (gross_total < old_order_date[0].paid_amount) {
      req.flash("error", "gross_total Less-than paid_amount");
      return res.json(400);
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    // await DataFind(
    //   "UPDATE tbl_order SET coupon_id='0', coupon_discount='0', tax_amount =ROUND((sub_total + addon_price - coupon_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount ,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2) WHERE id='" +
    //     req.body.order_id +
    //     "'"
    // );

    const orderUpdate = await DataUpdate(
      "tbl_order",
      `coupon_id = '0',
   coupon_discount = 0,
   tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance_amount = ROUND(gross_total - paid_amount, 2),
   master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)`,
      `id = '${req.body.order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderUpdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET coupon_id='"+couponid+"', coupon_discount="+coupon[0].discount+", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount ,2) WHERE created_by='"+loginas+','+id+"'");

    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// Add manual coupons to cart
router.get("/manualcoupon/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponcode = req.params.id.toUpperCase();

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var coupon = await DataFind(
      "select * from tbl_coupon where code='" + couponcode + "'",
    );

    if (coupon.length <= 0) {
      return res.status(200).json({
        cart: cart[0],
        status: "error",
        message: "Invalid coupon code",
      });
    } else {
      var customer_order = await DataFind(
        "SELECT * From tbl_order WHERE customer_id=" + cart[0].customer_id + "",
      );

      if (coupon[0].coupon_type == 2 && customer_order.length > 0) {
        return res.status(200).json({
          cart: cart[0],
          status: "error",
          message: "This Coupon Valied Only For first Order",
        });
      }
      var usedcoupon = customer_order.map((data) => data.coupon_id);
      if (
        coupon[0].limit_forsame_user <=
        usedcoupon.filter((i) => i == coupon[0].id).length
      ) {
        return res.status(200).json({
          cart: cart[0],
          status: "error",
          message: "You reached This coupon use Limit",
        });
      }

      if (coupon[0].min_purchase > cart[0].sub_total + cart[0].addon_price) {
        return res.status(200).json({
          cart: cart[0],
          status: "error",
          message:
            "min order amount for this coupon is " + coupon[0].min_purchase,
        });
      }
    }

    // const cartupdate = await DataFind(
    //   "UPDATE tbl_cart SET coupon_id='" +
    //     coupon[0].id +
    //     "', coupon_discount=" +
    //     coupon[0].discount +
    //     ", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='" +
    //     loginas +
    //     "," +
    //     id +
    //     "'"
    // );

    const cartupdate = await DataUpdate(
      "tbl_cart",
      `coupon_id = '${coupon[0].id}',
   coupon_discount = ${coupon[0].discount},
   tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * tax / 100, 2),
   gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
   balance = ROUND(gross_total - paid_amount, 2)`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (cartupdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );

    res.status(200).json({ cart: cart[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// edit manual coupons to cart
router.post("/edit_manualcoupon", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    var couponcode = req.body.code.toUpperCase();
    console.log(2222, req.body);

    //  var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    const old_order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );

    var coupon = await DataFind(
      "select * from tbl_coupon where code='" + couponcode + "'",
    );

    console.log("old_order_date", old_order_date);

    const sub_total = parseFloat(old_order_date[0].sub_total);
    console.log("sub_total", sub_total);
    const tax_amount = (
      (parseFloat(sub_total) +
        parseFloat(old_order_date[0].addon_price) -
        parseFloat(coupon[0].discount)) *
      (parseFloat(old_order_date[0].tax) / 100)
    ).toFixed(2);
    console.log("tax_amount", tax_amount);
    const gross_total = (
      parseFloat(sub_total) +
      parseFloat(tax_amount) +
      parseFloat(old_order_date[0].addon_price) -
      parseFloat(coupon[0].discount) -
      parseFloat(old_order_date[0].extra_discount)
    ).toFixed(2);
    console.log("gross_total", gross_total);

    if (gross_total < old_order_date[0].paid_amount) {
      req.flash("error", "gross_total Less-than paid_amount");
      return res.json(400);
    }

    if (coupon.length <= 0) {
      return res.status(200).json({
        old_order_date: old_order_date[0],
        status: "error",
        message: "Invalid coupon code",
      });
    } else {
      var customer_order = await DataFind(
        "SELECT * From tbl_order WHERE customer_id=" +
          old_order_date[0].customer_id +
          "",
      );

      if (coupon[0].coupon_type == 2 && customer_order.length > 0) {
        return res.status(200).json({
          old_order_date: old_order_date[0],
          status: "error",
          message: "This Coupon Valied Only For first Order",
        });
      }
      var usedcoupon = customer_order.map((data) => data.coupon_id);
      if (
        coupon[0].limit_forsame_user <=
        usedcoupon.filter((i) => i == coupon[0].id).length
      ) {
        return res.status(200).json({
          old_order_date: old_order_date[0],
          status: "error",
          message: "You reached This coupon use Limit",
        });
      }

      if (
        coupon[0].min_purchase >
        old_order_date[0].sub_total + old_order_date[0].addon_price
      ) {
        return res.status(200).json({
          old_order_date: old_order_date[0],
          status: "error",
          message:
            "min order amount for this coupon is " + coupon[0].min_purchase,
        });
      }
    }

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${old_order_date[0].store_id}'`,
    );

    // await DataFind(
    //   "UPDATE tbl_order SET coupon_id='" +
    //     coupon[0].id +
    //     "', coupon_discount=" +
    //     coupon[0].discount +
    //     ", tax_amount =ROUND((sub_total + addon_price - coupon_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance_amount = ROUND(gross_total - paid_amount,2), master_comission = ROUND((gross_total * '" +
    //     store_data[0].shop_commission +
    //     "') / 100,2) WHERE id='" +
    //     req.body.order_id +
    //     "'"
    // );

    const orderUpdate = await DataUpdate(
      "tbl_order",
      `coupon_id = '${coupon[0].id}',
         coupon_discount = ${coupon[0].discount},
         tax_amount = ROUND((sub_total + addon_price - coupon_discount) * tax / 100, 2),
         gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
         balance_amount = ROUND(gross_total - paid_amount, 2),
         master_comission = ROUND((gross_total * ${store_data[0].shop_commission}) / 100, 2)`,
      `id = '${req.body.order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (orderUpdate === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const cartupdate = await DataFind("UPDATE tbl_cart SET coupon_id='"+coupon[0].id+"', coupon_discount="+coupon[0].discount+", tax_amount =ROUND((sub_total + addon_price - coupon_discount - extra_discount)*tax / 100,2), gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount,2), balance = ROUND(gross_total - paid_amount,2)  WHERE created_by='"+loginas+','+id+"'");

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id='${req.body.order_id}'`,
    );
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        order_date[0].service_list +
        "')",
    );

    res.status(200).json({ order_date: order_date[0], cartservice, loginas });
  } catch (error) {
    console.log(error);
  }
});

// payment model require data
router.get("/paymentdata", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    var cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    console.log("cart", cart);

    var payment = await DataFind(
      "SELECT id, ac_name From tbl_account WHERE store_ID=" +
        cart[0].store_id +
        " AND delet_flage != '1'  ",
    );
    console.log("payment", payment);

    res.status(200).json({ cart: cart[0], payment });
  } catch (error) {
    console.log(error);
  }
});

// edit payment model require data
router.post("/edit_paymentdata", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.body.order_id}'`,
    );
    console.log("order_date", order_date);
    // var cart = await DataFind(" SELECT * FROM tbl_cart WHERE created_by='"+loginas+','+id+"'");
    var payment = await DataFind(
      "SELECT id, ac_name From tbl_account WHERE store_ID=" +
        order_date[0].store_id +
        " AND delet_flage != '1'  ",
    );
    console.log("payment", payment);

    res.status(200).json({ order_date: order_date[0], payment });
  } catch (error) {
    console.log(error);
  }
});

// Edit order save from modal
router.post("/edit_order", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    var {
      order_id,
      deliverydate,
      extradiscount,
      paid_amount,
      payment_type,
      note,
      reference_number,
    } = req.body;
    paid_amount = parseFloat(paid_amount) || 0;
    extradiscount = parseFloat(extradiscount) || 0;

    const old_order = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${order_id}'`,
    );
    if (!old_order || old_order.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = old_order[0];
    const sub_total = parseFloat(order.sub_total) || 0;
    const addon_price = parseFloat(order.addon_price) || 0;
    const coupon_discount = parseFloat(order.coupon_discount) || 0;
    const tax_rate = parseFloat(order.tax) || 0;

    const tax_amount = parseFloat(
      ((sub_total + addon_price - coupon_discount) * (tax_rate / 100)).toFixed(
        2,
      ),
    );
    const gross_total = parseFloat(
      (
        sub_total +
        tax_amount +
        addon_price -
        coupon_discount -
        extradiscount
      ).toFixed(2),
    );

    const previous_paid = parseFloat(order.paid_amount) || 0;
    const total_paid = parseFloat((previous_paid + paid_amount).toFixed(2));
    const balance_amount = parseFloat((gross_total - total_paid).toFixed(2));

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${order.store_id}'`,
    );
    const shop_commission =
      store_data && store_data[0]
        ? parseFloat(store_data[0].shop_commission)
        : 0;
    const master_comission = parseFloat(
      ((gross_total * shop_commission) / 100).toFixed(2),
    );

    let delDate = deliverydate || order.delivery_date;
    if (delDate) {
      delDate = formatMySQLDateTime(delDate, req.body.deliverytime || "16:00:00");
    }

    const orderNotes = note !== undefined ? note : order.note;
    const refNum =
      reference_number !== undefined
        ? reference_number
        : order.reference_number || "";

    await DataUpdate(
      `tbl_order`,
      `
        delivery_date = '${delDate}',
        extra_discount = ${extradiscount},
        sub_total = ${sub_total},
        tax_amount = ${tax_amount},
        gross_total = ${gross_total},
        paid_amount = ${total_paid},
        balance_amount = ${balance_amount},
        master_comission = ${master_comission},
        note = '${orderNotes || ""}',
        reference_number = '${refNum}'
      `,
      `id = '${order_id}'`,
      req.hostname,
      req.protocol,
    );

    if (paid_amount > 0 && payment_type) {
      const pay_date = new Date().toISOString().slice(0, 10);
      await DataInsert(
        `tbl_order_payment`,
        `payment_amount, payment_date, payment_account, order_id, reference_number`,
        `${paid_amount}, '${pay_date}', '${payment_type}', '${order_id}', '${refNum}'`,
        req.hostname,
        req.protocol,
      );

      const account = await DataFind(
        `SELECT id, store_ID FROM tbl_account WHERE store_ID = '${order.store_id}' AND delet_flage != '1' LIMIT 1`,
      );
      const account_id = account && account[0] ? account[0].id : 1;
      await DataInsert(
        `tbl_transections`,
        `account_id, store_ID, transec_detail, transec_type, debit_amount, credit_amount, balance_amount, date, customer_id`,
        `'${account_id}', '${order.store_id}', 'POS Order Update Payment ${order.order_id}', 'INCOME', 0, ${paid_amount}, ${paid_amount}, '${pay_date}', '${order.customer_id}'`,
        req.hostname,
        req.protocol,
      );
    }

    const updated_order = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${order_id}'`,
    );
    const customer_data = await DataFind(
      `SELECT * FROM tbl_customer WHERE id = '${order.customer_id}'`,
    );
    const cartservice = await DataFind(
      `SELECT * FROM tbl_cart_servicelist WHERE find_in_set(id, '${order.service_list}')`,
    );
    let addonslist = [];
    if (order.addon_data && order.addon_data.length > 0) {
      addonslist = await DataFind(
        `SELECT id, addon as name, price FROM tbl_addons WHERE find_in_set(id, '${order.addon_data}')`,
      );
    }

    return res.json({
      success: true,
      order: updated_order[0],
      shope: store_data[0] || {},
      customer: customer_data[0] || {},
      cartservice: cartservice || [],
      addonslist: addonslist || [],
      paymenttype: payment_type || "cash",
    });
  } catch (error) {
    console.error("Error in /admin/edit_order:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// Edit order direct quick save
router.post("/edit_order_direct", auth, async (req, res) => {
  try {
    const { order_id, delivery_date } = req.body;
    const old_order = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${order_id}'`,
    );
    if (!old_order || old_order.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const order = old_order[0];
    let cartservice = [];
    if (order.service_list && order.service_list.trim().length > 0) {
      cartservice = await DataFind(
        `SELECT * FROM tbl_cart_servicelist WHERE find_in_set(id, '${order.service_list}')`,
      );
    }

    let sub_total = 0;
    cartservice.forEach((item) => {
      sub_total +=
        (parseFloat(item.service_type_price) || 0) *
        (parseFloat(item.service_quntity) || 1);
    });
    sub_total = parseFloat(sub_total.toFixed(2));

    const addon_price = parseFloat(order.addon_price) || 0;
    const coupon_discount = parseFloat(order.coupon_discount) || 0;
    const extra_discount = parseFloat(order.extra_discount) || 0;
    const tax_rate = parseFloat(order.tax) || 0;

    const tax_amount = parseFloat(
      ((sub_total + addon_price - coupon_discount) * (tax_rate / 100)).toFixed(
        2,
      ),
    );
    const gross_total = parseFloat(
      (
        sub_total +
        tax_amount +
        addon_price -
        coupon_discount -
        extra_discount
      ).toFixed(2),
    );
    const paid_amount = parseFloat(order.paid_amount) || 0;
    const balance_amount = parseFloat((gross_total - paid_amount).toFixed(2));

    const store_data = await DataFind(
      `SELECT * FROM tbl_store WHERE id = '${order.store_id}'`,
    );
    const shop_commission =
      store_data && store_data[0]
        ? parseFloat(store_data[0].shop_commission)
        : 0;
    const master_comission = parseFloat(
      ((gross_total * shop_commission) / 100).toFixed(2),
    );

    let deliveryUpdate = "";
    if (delivery_date) {
      let fullDelivery = formatMySQLDateTime(delivery_date, req.body.delivery_time || "16:00:00");
      deliveryUpdate = `delivery_date = '${fullDelivery}',`;
    }

    await DataUpdate(
      `tbl_order`,
      `
        ${deliveryUpdate}
        sub_total = ${sub_total},
        tax_amount = ${tax_amount},
        gross_total = ${gross_total},
        balance_amount = ${balance_amount},
        master_comission = ${master_comission}
      `,
      `id = '${order_id}'`,
      req.hostname,
      req.protocol,
    );

    return res.json({ success: true, order_id });
  } catch (error) {
    console.error("Error in /admin/edit_order_direct:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

//save order
router.post("/order", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    var orderid = await idfororder();

    var { deliverydate, deliverytime, extradiscount, paid_amount, note, reference_number } =
      req.body;

    paid_amount ? (paid_amount = paid_amount) : (paid_amount = 0);
    extradiscount ? (extradiscount = extradiscount) : (extradiscount = 0);
    var payment_type = req.body.payment_type;
    payment_type ? payment_type : (payment_type = 0);
    const cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );

    const gross = parseFloat(cart[0].gross_total) - parseFloat(extradiscount);
    const balance =
      parseFloat(cart[0].gross_total) -
      parseFloat(extradiscount) -
      parseFloat(paid_amount);
    const comiss = await DataFind(
      "SELECT shop_commission From tbl_store WHERE id=" + cart[0].store_id + "",
    );
    const comi_amount =
      (parseFloat(gross) * parseFloat(comiss[0].shop_commission)) /
      parseFloat(100);

    let order_date = new Date(cart[0].order_date);
    let order_day =
      (order_date.getDate() < 10 ? "0" : "") + order_date.getDate();
    let order_month =
      (order_date.getMonth() + 1 < 10 ? "0" : "") + (order_date.getMonth() + 1);
    let order_year = order_date.getFullYear();
    let order_fullDate = `${order_year}-${order_month}-${order_day}`;
    let finalDeliveryDate = deliverydate
      ? formatMySQLDateTime(deliverydate, deliverytime || "16:00:00")
      : (cart[0].delivery_date
        ? formatMySQLDateTime(cart[0].delivery_date)
        : `${order_fullDate} 16:00:00`);

    const order = await DataInsert(
      `tbl_order`,
      `order_id,order_date,delivery_date,order_status,service_list,customer_id,created_by,store_id,addon_data,
        addon_price,sub_total,tax,coupon_id,coupon_discount,extra_discount,gross_total,paid_amount,balance_amount,payment_data,tax_amount,note,master_comission, commission_status,reference_number`,
      `'${orderid}',
        '${order_fullDate}','${finalDeliveryDate}',${1},'${
          cart[0].service_list_id
        }','${cart[0].customer_id}','${cart[0].created_by}','${
          cart[0].store_id
        }','${cart[0].addon_id}',
        ${cart[0].addon_price},${cart[0].sub_total},'${cart[0].tax}','${
          cart[0].coupon_id
        }',${
          cart[0].coupon_discount
        },${extradiscount},${gross},${paid_amount},${balance},
        '${0}',${cart[0].tax_amount},'${note}',${comi_amount},'1','${reference_number || ""}'`,
      req.hostname,
      req.protocol,
    );

    if (order == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // await DataFind(
    //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].customer_id}', 'There is a new order registered, please check it orderid ${orderid}. ')`
    // );

    const custnofication = await DataInsert(
      `tbl_notification`,
      `invoice, date, sender, received, notification`,
      `'${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].customer_id}', 'There is a new order registered, please check it orderid ${orderid}. '`,
      req.hostname,
      req.protocol,
    );

    if (custnofication == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // await DataFind(
    //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].store_id}', 'There is a new order registered, please check it orderid ${orderid}.')`
    // );

    const storenotification = await DataInsert(
      `tbl_notification`,
      `invoice, date, sender, received, notification`,
      `${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].store_id}', 'There is a new order registered, please check it orderid ${orderid}.'`,
      req.hostname,
      req.protocol,
    );

    if (storenotification == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // await DataFind(
    //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '1', 'There is a new order registered, please check it.')`
    // );

    // const paymentdata =
    //   await DataFind(`INSERT INTO tbl_order_payment (payment_amount,payment_date,payment_account,order_id) VALUE (${paid_amount},'${order_fullDate}',
    //     '${payment_type}','${order.insertId}')`);

    const paymentdata = await DataInsert(
      `tbl_order_payment`,
      `payment_amount,payment_date,payment_account,order_id,reference_number`,
      `${paid_amount},'${order_fullDate}',
        '${payment_type}','${order.insertId}','${reference_number || ""}'`,
      req.hostname,
      req.protocol,
    );

    if (paymentdata == -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // const updateorder = await DataFind(
    //   `UPDATE tbl_order SET payment_data='${paymentdata.insertId}' WHERE id='${order.insertId}'`
    // );

    const updateorder = await DataUpdate(
      "tbl_order",
      `payment_data = '${paymentdata.insertId}'`,
      `id = '${order.insertId}'`,
      req.hostname,
      req.protocol,
    );

    if (updateorder === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    const customer_data = await DataFind(
      `SELECT * FROM tbl_customer WHERE id = '${cart[0].customer_id}'`,
    );

    if (
      payment_type &&
      payment_type != 0 &&
      payment_type != "0" &&
      parseFloat(paid_amount) > 0
    ) {
      const account = await DataFind(
        "SELECT * FROM tbl_account WHERE id='" + payment_type + "'",
      );

      if (account && account.length > 0) {
        const balance =
          parseFloat(account[0].balance || 0) + parseFloat(paid_amount);

        const updateAccount = await DataUpdate(
          "tbl_account",
          `balance = '${balance}'`,
          `id = '${payment_type}'`,
          req.hostname,
          req.protocol,
        );

        if (updateAccount === -1) {
          req.flash("errors", process.env.dataerror);
          return res.redirect("/valid_license");
        }

        var abc = await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,debit_amount,
                  credit_amount,balance_amount,date, customer_id`,
          `'${payment_type}','${account[0].store_ID}','POS Income ${orderid}','INCOME',
                  0,${paid_amount},${balance},'${order_fullDate}','${cart[0].customer_id}'`,
          req.hostname,
          req.protocol,
        );

        if (abc == -1) {
          req.flash("errors", process.env.dataerror);
          return res.redirect("/valid_license");
        }
      }
    }

    // clear cart

    var orderid = await idfororder();
    var tax = await DataFind(
      "SELECT tax_percent FROM tbl_store WHERE id=" + cart[0].store_id + "",
    );

    // await DataFind(`UPDATE tbl_cart SET order_date=CURRENT_TIMESTAMP,service_list_id=0,addon_id=0,addon_price=0,delivery_date=CURRENT_TIMESTAMP,extra_discount=0,
    //     coupon_id=0,coupon_discount=0,tax_amount=0,sub_total=0,gross_total=0,paid_amount=0,payment_type=0, order_id='${orderid}',customer_id='0',
    //     balance=0,notes='', tax=${tax[0].tax_percent} WHERE created_by='${loginas},${id}'`);

    const updateCart = await DataUpdate(
      "tbl_cart",
      `order_date = CURRENT_TIMESTAMP,
   service_list_id = 0,
   addon_id = 0,
   addon_price = 0,
   delivery_date = CURRENT_TIMESTAMP,
   extra_discount = 0,
   coupon_id = 0,
   coupon_discount = 0,
   tax_amount = 0,
   sub_total = 0,
   gross_total = 0,
   paid_amount = 0,
   payment_type = 0,
   order_id = '${orderid}',
   customer_id = '0',
   balance = 0,
   notes = '',
   tax = ${tax[0].tax_percent}`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    if (updateCart === -1) {
      req.flash("errors", process.env.dataerror);
      return res.redirect("/valid_license");
    }

    // data for invoice
    var cartservice = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        cart[0].service_list_id +
        "')",
    );
    var shope = await DataFind(
      "SELECT * FROM tbl_store WHERE id=" + cart[0].store_id + "",
    );
    var orderdata = await DataFind(
      "SELECT * FROM tbl_order WHERE id=" + order.insertId + "",
    );

    const addon =
      orderdata && orderdata.length > 0 && orderdata[0].addon_data
        ? orderdata[0].addon_data.split(",")
        : ["0"];
    if (addon[0] != 0) {
      var addonslist = await Promise.all(
        addon.map(async (data, i) => {
          var addondata = await DataFind(
            "SELECT * FROM tbl_addons WHERE id=" + data + "",
          );

          return {
            id: addondata[0].id,
            name: addondata[0].addon,
            price: addondata[0].price,
          };
        }),
      );
    } else {
      var addonslist = [];
    }

    if (payment_type == 0) {
      var paymenttype = "No Amount Paid";
    } else {
      const payment = await DataFind(
        "SELECT ac_name From tbl_account WHERE id=" + payment_type + "",
      );
      var paymenttype = payment[0].ac_name;
    }

    var coust = await DataFind(
      "SELECT * From tbl_customer WHERE id=" + orderdata[0].customer_id + "",
    );

    console.log("orderdata[0]", orderdata[0]);

    const data = await DataFind(
      "SELECT * FROM tbl_email WHERE store_id=" + cart[0].store_id + "",
    );
    console.log(111, "data", data);
    if (
      data.length > 0 &&
      coust.length > 0 &&
      coust[0].email !== null &&
      coust[0].email !== ""
    ) {
      if (
        data[0].host &&
        data[0].port &&
        data[0].username &&
        data[0].password &&
        data[0].frommail
      ) {
        const transporter = nodemailer.createTransport({
          host: data[0].host,
          port: Number(data[0].port),
          // service: "gmail",
          auth: {
            user: data[0].username,
            pass: data[0].password,
          },
        });

        let mailDetails = {
          // from: data[0].frommail,
          from: data[0].frommail,
          to: coust[0].email,
          subject: "Email From " + shope[0].name,
          html:
            "<!DOCTYPE html>" +
            "<html><head><title></title>" +
            "</head><body><div>" +
            "<h5>Greeting From " +
            shope[0].name +
            "</h5>" +
            "<p> Woo hoo! Your order is on its way. Your order details can be found below. </p>" +
            "<p>ORDER SUMMARY:</p>" +
            "<p>Order #: " +
            orderid +
            " </p>" +
            "<p>Order Date: " +
            order_fullDate +
            " </p>" +
            "<p>Order Total: " +
            gross +
            " </p>" +
            "<br>" +
            "<p> We hope you enjoyed your shopping experience with us and that you will visit us again soon. </p>" +
            '</div><div style="display: list-item;">' +
            "<p>Best from :</p>" +
            '<span style="margin-bottom:0">' +
            shope[0].mobile_number +
            "</span><br>" +
            '<span style="margin-bottom:0">' +
            shope[0].store_email +
            "</span><br>" +
            '<span style="margin-bottom:0">' +
            shope[0].city +
            "</span><br>" +
            "</div></body></html>",
        };

        transporter.sendMail(mailDetails, function (err, data) {
          if (err) {
            console.log(err);
            console.log("Error Occurs");
            req.flash("error", "Message not occurred!");
          } else {
            console.log("Email sent successfully");
            req.flash("success", "Email Send Successful");
          }
        });
      }
    }

    console.log(333, coust);
    if (coust[0].name != "Walk in customer") {
      // ========= sms ============ //

      let tsid = (shope && shope.length > 0 && shope[0].twilio_sid) ? shope[0].twilio_sid : accessdata.masterstore.twilio_sid;
      let ttoken = (shope && shope.length > 0 && shope[0].twilio_auth_token) ? shope[0].twilio_auth_token : accessdata.masterstore.twilio_auth_token;
      let tphone = (shope && shope.length > 0 && shope[0].twilio_phone_no) ? shope[0].twilio_phone_no : accessdata.masterstore.twilio_phone_no;

      if (tsid && ttoken) {
        let ACCOUNT_SID = tsid;
        let AUTH_TOKEN = ttoken;
        const client_sms = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);

        client_sms.messages
          .create({
            body: `We have successfully processed your order and it is now en route to the destination. Thank you for using our services, we appreciate your business!`,
            from: tphone,
            to: customer_data[0].number,
          })
          .then((message) => console.log(message.sid))
          .catch((e) => {
            req.flash("error", "Message not occurred!");
          });
      }
    }

    // ----------- Notification ------------ //

    if (accessdata.masterstore.onesignal_app_id) {
      let message = {
        app_id: accessdata.masterstore.onesignal_app_id,
        contents: { en: "There is a new order registered, please check it." },
        headings: { en: "laundry" },
        included_segments: ["Subscribed Users"],
        filters: [
          {
            field: "tag",
            key: "subscription_user_Type",
            relation: "=",
            value: "master",
          },
          { operator: "AND" },
          { field: "tag", key: "Login_ID", relation: "=", value: "1" },
        ],
      };
      sendNotification(message);

      let customer_message = {
        app_id: accessdata.masterstore.onesignal_app_id,
        contents: { en: "There is a new order registered, please check it." },
        headings: { en: "laundry" },
        included_segments: ["Subscribed Users"],
        filters: [
          {
            field: "tag",
            key: "subscription_user_Type",
            relation: "=",
            value: accessdata.logas,
          },
          { operator: "AND" },
          {
            field: "tag",
            key: "Login_ID",
            relation: "=",
            value: accessdata.topbardata.id,
          },
        ],
      };
      sendNotification(customer_message);
    }

    res.status(200).json({
      status: "success",
      cartservice,
      shope: shope[0],
      order: orderdata[0],
      addonslist,
      paymenttype,
      customer: coust[0],
    });
  } catch (error) {
    console.log("error", error);
  }
});

router.post("/save_order", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    var orderid = await idfororder();

    var { deliverydate, deliverytime, extradiscount, paid_amount, note, reference_number } =
      req.body;

    paid_amount = paid_amount ? parseFloat(paid_amount) || 0 : 0;
    extradiscount = extradiscount ? parseFloat(extradiscount) || 0 : 0;
    var payment_type = req.body.payment_type;
    payment_type = payment_type ? payment_type : 0;

    const cart = await DataFind(
      " SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'",
    );
    if (!cart || cart.length === 0 || !cart[0].service_list_id || cart[0].service_list_id === "0") {
      return res.status(400).json({ success: false, message: "Cart is empty or not found." });
    }

    const gross = parseFloat(cart[0].gross_total) - parseFloat(extradiscount);
    const balance =
      parseFloat(cart[0].gross_total) -
      parseFloat(extradiscount) -
      parseFloat(paid_amount);
    const comiss = await DataFind(
      "SELECT shop_commission From tbl_store WHERE id=" + cart[0].store_id + "",
    );

    const comi_amount =
      (parseFloat(gross) * parseFloat((comiss && comiss.length > 0 && comiss[0].shop_commission) || 0)) /
      parseFloat(100);

    let order_date = new Date(cart[0].order_date);
    let order_day =
      (order_date.getDate() < 10 ? "0" : "") + order_date.getDate();
    let order_month =
      (order_date.getMonth() + 1 < 10 ? "0" : "") + (order_date.getMonth() + 1);
    let order_year = order_date.getFullYear();
    let order_fullDate = `${order_year}-${order_month}-${order_day}`;
    let finalDeliveryDate = deliverydate
      ? formatMySQLDateTime(deliverydate, deliverytime || "16:00:00")
      : (cart[0].delivery_date
        ? formatMySQLDateTime(cart[0].delivery_date)
        : `${order_fullDate} 16:00:00`);

    const order = await DataInsert(
      `tbl_order`,
      `order_id,order_date,delivery_date,order_status,service_list,customer_id,created_by,store_id,addon_data,
        addon_price,sub_total,tax,coupon_id,coupon_discount,extra_discount,gross_total,paid_amount,balance_amount,payment_data,tax_amount,note,master_comission,commission_status,reference_number`,
      `'${orderid}',
        '${order_fullDate}','${finalDeliveryDate}',${1},'${
          cart[0].service_list_id
        }','${cart[0].customer_id}','${cart[0].created_by}','${
          cart[0].store_id
        }','${cart[0].addon_id}',
        ${cart[0].addon_price},${cart[0].sub_total},'${cart[0].tax}','${
          cart[0].coupon_id
        }',${
          cart[0].coupon_discount
        },${extradiscount},${gross},${paid_amount},${balance},
        '${0}',${cart[0].tax_amount},'${note}',${comi_amount},'1','${reference_number || ""}'`,
      req.hostname,
      req.protocol,
    );

    if (order == -1) {
      return res.status(500).json({ success: false, message: process.env.dataerror || "Database error creating order." });
    }

    const custnotifiction = await DataInsert(
      `tbl_notification`,
      `invoice, date, sender, received, notification`,
      `'${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].customer_id}', 'There is a new order registered, please check it orderid ${orderid}.'`,
      req.hostname,
      req.protocol,
    );

    const storenotifiction = await DataInsert(
      `tbl_notification`,
      `invoice, date, sender, received, notification`,
      `'${orderid}', '${order_fullDate}', '${accessdata.topbardata.id}', '${cart[0].store_id}', 'There is a new order registered, please check it orderid ${orderid}.'`,
      req.hostname,
      req.protocol,
    );

    const paymentdata = await DataInsert(
      `tbl_order_payment`,
      `payment_amount,payment_date,payment_account,order_id,reference_number`,
      `${paid_amount},'${order_fullDate}',
            '${payment_type}','${order.insertId}','${reference_number || ""}'`,
      req.hostname,
      req.protocol,
    );

    if (paymentdata != -1) {
      await DataUpdate(
        "tbl_order",
        `payment_data = '${paymentdata.insertId}'`,
        `id = '${order.insertId}'`,
        req.hostname,
        req.protocol,
      );
    }

    const customer_data = await DataFind(
      `SELECT * FROM tbl_customer WHERE id = '${cart[0].customer_id}'`,
    );

    if (
      payment_type &&
      payment_type != 0 &&
      payment_type != "0" &&
      parseFloat(paid_amount) > 0
    ) {
      const account = await DataFind(
        "SELECT * FROM tbl_account WHERE id='" + payment_type + "'",
      );

      if (account && account.length > 0) {
        const balance =
          parseFloat(account[0].balance || 0) + parseFloat(paid_amount);

        await DataUpdate(
          "tbl_account",
          `balance = ${balance}`,
          `id = ${payment_type}`,
          req.hostname,
          req.protocol,
        );

        await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,debit_amount,credit_amount,balance_amount,date, customer_id`,
          `'${payment_type}','${account[0].store_ID}','POS Income ${orderid}','INCOME',0,${paid_amount},${balance},'${order_fullDate}', '${cart[0].customer_id}'`,
          req.hostname,
          req.protocol,
        );
      }
    }

    // clear cart
    var neworderid = await idfororder();
    var tax = await DataFind(
      "SELECT tax_percent FROM tbl_store WHERE id=" + cart[0].store_id + "",
    );

    await DataUpdate(
      "tbl_cart",
      `order_date = CURRENT_TIMESTAMP,
   service_list_id = 0,
   addon_id = 0,
   addon_price = 0,
   delivery_date = CURRENT_TIMESTAMP,
   extra_discount = 0,
   coupon_id = 0,
   coupon_discount = 0,
   tax_amount = 0,
   sub_total = 0,
   gross_total = 0,
   paid_amount = 0,
   payment_type = 0,
   order_id = '${neworderid}',
   customer_id = '0',
   balance = 0,
   notes = '',
   tax = ${tax[0].tax_percent}`,
      `created_by = '${loginas},${id}'`,
      req.hostname,
      req.protocol,
    );

    var shope = await DataFind(
      "SELECT * FROM tbl_store WHERE id=" + cart[0].store_id + "",
    );

    var coust = await DataFind(
      "SELECT * From tbl_customer WHERE id=" + cart[0].customer_id + "",
    );

    const emailData = await DataFind(
      "SELECT * FROM tbl_email WHERE store_id=" + cart[0].store_id + "",
    );

    if (
      emailData.length > 0 &&
      coust.length > 0 &&
      coust[0].email !== null &&
      coust[0].email !== ""
    ) {
      if (
        emailData[0].host &&
        emailData[0].port &&
        emailData[0].username &&
        emailData[0].password &&
        emailData[0].frommail
      ) {
        try {
          const transporter = nodemailer.createTransport({
            host: emailData[0].host,
            port: Number(emailData[0].port),
            auth: {
              user: emailData[0].username,
              pass: emailData[0].password,
            },
          });

          let mailDetails = {
            from: emailData[0].frommail,
            to: coust[0].email,
            subject: "Email From " + (shope && shope.length > 0 ? shope[0].name : "Store"),
            html: `
      <div style="font-family: Arial, sans-serif; font-size: 14px; color: #333;">
      <h2 style="color: #4CAF50;">Thank you for your order, ${
        coust[0].name || "Customer"
      }!</h2>
      <p>Your order has been received. Below are your order details:</p>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td><strong>Order Number: </strong> ${orderid}</td>
        </tr>
        <tr>
          <td><strong>Order Date: </strong> ${order_fullDate}</td>
        </tr>
        <tr>
          <td><strong>Total Amount: </strong> <span class="symbol">${
            accessdata.masterstore.currency_symbol
          }${gross}</span></td>
        </tr>
      </table>
      <br>
      <p>We appreciate your business and hope you enjoy your purchase!</p>
      <hr>
      <p style="font-size: 12px; color: #999;">
        ${shope && shope.length > 0 ? shope[0].name : ''} <br>
        📞 ${shope && shope.length > 0 ? shope[0].mobile_number : ''} <br>
        ✉️ ${shope && shope.length > 0 ? shope[0].store_email : ''} <br>
        📍 ${shope && shope.length > 0 ? shope[0].city : ''}
      </p>
    </div>
  `,
          };

          transporter.sendMail(mailDetails, function (err, data) {
            if (err) {
              console.log("Email error:", err);
            }
          });
        } catch (e) {
          console.log("Transporter error:", e);
        }
      }
    }

    if (coust.length > 0 && coust[0].number != null) {
      let tsid = (shope && shope.length > 0 && shope[0].twilio_sid) ? shope[0].twilio_sid : accessdata.masterstore.twilio_sid;
      let ttoken = (shope && shope.length > 0 && shope[0].twilio_auth_token) ? shope[0].twilio_auth_token : accessdata.masterstore.twilio_auth_token;
      let tphone = (shope && shope.length > 0 && shope[0].twilio_phone_no) ? shope[0].twilio_phone_no : accessdata.masterstore.twilio_phone_no;

      if (tsid && ttoken) {
        try {
          const client_sms = require("twilio")(tsid, ttoken);
          if (client_sms) {
            client_sms.messages
              .create({
                body: `We have successfully processed your order and it is now en route to the destination. Thank you for using our services, we appreciate your business!`,
                from: tphone,
                to: customer_data[0].number,
              })
              .catch((e) => console.log("SMS error:", e));
          }
        } catch (error) {
          console.log(error);
        }
      }
    }

    // Notification
    let onesignalAppId = (shope && shope.length > 0 && shope[0].onesignal_app_id) ? shope[0].onesignal_app_id : accessdata.masterstore.onesignal_app_id;
    if (onesignalAppId) {
      let message = {
        app_id: onesignalAppId,
        contents: { en: "There is a new order registered, please check it." },
        headings: { en: "laundry" },
        included_segments: ["Subscribed Users"],
        filters: [
          {
            field: "tag",
            key: "subscription_user_Type",
            relation: "=",
            value: "master",
          },
          { operator: "AND" },
          { field: "tag", key: "Login_ID", relation: "=", value: "1" },
        ],
      };
      sendNotification(message);

      let customer_message = {
        app_id: onesignalAppId,
        contents: { en: "There is a new order registered, please check it." },
        headings: { en: "laundry" },
        included_segments: ["Subscribed Users"],
        filters: [
          {
            field: "tag",
            key: "subscription_user_Type",
            relation: "=",
            value: accessdata.logas,
          },
          { operator: "AND" },
          {
            field: "tag",
            key: "Login_ID",
            relation: "=",
            value: accessdata.topbardata.id,
          },
        ],
      };
      sendNotification(customer_message);
    }

    return res.status(200).json({
      success: true,
      message: "Order placed successfully!",
      order_id: orderid,
      id: order.insertId
    });
  } catch (error) {
    console.error("Error saving order:", error);
    return res.status(500).json({ success: false, message: "An unexpected error occurred while placing the order." });
  }
});

// GET /posprint - renders invoice & wash tags by order ID
const renderPosPrint = async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    var orderid =
      req.query.id || req.query.orderid || req.params.id || (req.body && (req.body.id || req.body.orderid));

    if (!orderid) {
      req.flash("errors", "Order ID is required");
      return res.redirect("/admin/pos");
    }

    var orderdata = await DataFind(`
      SELECT ord.*, COALESCE(tbl_orderstatus.status, "") as order_status_name  
      FROM tbl_order as ord
      LEFT JOIN tbl_orderstatus on ord.order_status = tbl_orderstatus.id
      WHERE ord.id = '${orderid}' OR ord.order_id = '${orderid}'
      LIMIT 1
    `);

    if (!orderdata || orderdata.length === 0) {
      req.flash("errors", "Order not found");
      return res.redirect("/admin/pos");
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    if (isStaff && staffStoreId && orderdata[0].store_id != staffStoreId) {
      req.flash("errors", "You are not authorized to view orders from other stores");
      return res.redirect("/admin/pos");
    }

    var shope = await DataFind(
      "SELECT * FROM tbl_store WHERE id=" + orderdata[0].store_id + "",
    );

    let cartservice = [];
    if (orderdata[0].service_list) {
      cartservice = await DataFind(
        "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
          orderdata[0].service_list +
          "')",
      );
    }

    let addonslist = [];
    if (orderdata[0].addon_data) {
      const addon = orderdata[0].addon_data.toString().split(",");
      if (addon[0] && addon[0] != "0") {
        addonslist = await Promise.all(
          addon.filter(Boolean).map(async (data) => {
            var addondata = await DataFind(
              "SELECT * FROM tbl_addons WHERE id=" + data + "",
            );
            return addondata && addondata.length > 0
              ? {
                  id: addondata[0].id,
                  name: addondata[0].addon,
                  price: addondata[0].price,
                }
              : null;
          }),
        );
        addonslist = addonslist.filter(Boolean);
      }
    }

    var paymenttype = "No Amount Paid";
    if (orderdata[0].payment_data && orderdata[0].payment_data != "0") {
      const pRows = await DataFind(
        "SELECT * FROM tbl_order_payment WHERE id='" + orderdata[0].payment_data + "'",
      );
      if (pRows && pRows.length > 0 && pRows[0].payment_account) {
        const accRows = await DataFind(
          "SELECT ac_name FROM tbl_account WHERE id='" + pRows[0].payment_account + "'",
        );
        if (accRows && accRows.length > 0) {
          paymenttype = accRows[0].ac_name;
        } else if (pRows[0].payment_account != "0") {
          paymenttype = pRows[0].payment_account;
        }
      }
    }

    var coust = await DataFind(
      "SELECT * From tbl_customer WHERE id=" + orderdata[0].customer_id + "",
    );

    let oate = new Date(orderdata[0].order_date).toLocaleDateString("en-CA");
    let delDateObj = new Date(orderdata[0].delivery_date);
    let ddate = delDateObj.toLocaleDateString("en-CA");
    if (!isNaN(delDateObj.getTime())) {
      let hours = delDateObj.getHours();
      let minutes = String(delDateObj.getMinutes()).padStart(2, "0");
      let ampm = hours >= 12 ? "PM" : "AM";
      hours = hours % 12;
      hours = hours ? hours : 12;
      ddate += ` ${hours}:${minutes} ${ampm}`;
    }

    res.render("posprint", {
      cartservice,
      shope: shope && shope.length > 0 ? shope[0] : {},
      order: orderdata[0],
      addonslist,
      paymenttype,
      customer: coust && coust.length > 0 ? coust[0] : { name: "Walk in customer" },
      master: accessdata.masterstore,
      oate,
      ddate,
      accessdata,
    });
  } catch (error) {
    console.error("Error in renderPosPrint:", error);
    res.redirect("/admin/pos");
  }
};

router.get("/posprint", auth, renderPosPrint);
router.get("/posprint/:id", auth, renderPosPrint);
router.post("/posprint", auth, renderPosPrint);

router.get("/notification", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    res.render("notification", {
      accessdata,
      notification_data: [],
      order_date: [],
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/notification/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      return res
        .status(403)
        .json({
          draw: parseInt(req.query.draw) || 1,
          recordsTotal: 0,
          recordsFiltered: 0,
          data: [],
        });
    }

    const accessdata = await access(req.user);

    let scopeConditions = [];
    if (accessdata.mutibranch === true && accessdata.logas == "master") {
      // master multi-branch sees all
    } else if (
      (accessdata.mutibranch === false && accessdata.logas == "master") ||
      accessdata.logas == "store"
    ) {
      scopeConditions.push(
        `tbl_notification.received = '${accessdata.topbardata.store_ID}'`,
      );
    } else {
      scopeConditions.push(
        `tbl_notification.received = '${accessdata.topbardata.id}'`,
      );
    }

    const filterConditions = [];
    const dateParam = req.query.date_filter;
    if (dateParam && dateParam.trim() !== "") {
      const cleanDate = String(dateParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`DATE(tbl_notification.date) = '${cleanDate}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_notification.id, tbl_notification.invoice, tbl_notification.date, tbl_notification.sender, tbl_notification.received, tbl_notification.notification, tbl_order.id as order_primary_id`,
      from: `tbl_notification LEFT JOIN tbl_order ON tbl_notification.invoice = tbl_order.order_id`,
      searchColumns: [
        "tbl_notification.invoice",
        "tbl_notification.notification",
        "tbl_notification.date",
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_notification.id DESC",
      columnMap: {
        0: "tbl_notification.invoice",
        1: "tbl_notification.date",
        2: "tbl_notification.notification",
      },
      postProcess: async (rows) => {
        return rows.map((n) => ({
          id: n.id,
          invoice: n.invoice || "",
          date: n.date || "",
          notification: n.notification || "",
          order_id: n.order_primary_id || null,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Notification list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

module.exports = router;
