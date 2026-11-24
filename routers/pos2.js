const express = require("express");
const router = express.Router();
const path = require("path");
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
const { mySqlQury } = require("../middelwer/db");
const {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind,
} = require("../middelwer/databaseQurey");
const {
  getEffectiveReadySchedule,
  calculateReadyDateTime,
} = require("../middelwer/readyScheduleHelper");
const {
  attachPosImageMeta,
  getEffectivePosImageSize,
} = require("../middelwer/posImageHelper");
const { getActiveGenders } = require("../middelwer/genderHelper");
const { generateOrderId } = require("../middelwer/orderIdHelper");

function canOverridePosPriceDiscount(accessdata) {
  if (!accessdata || accessdata.logas === "custmor") return false;
  if (accessdata.logas === "master" || accessdata.roll?.rollType === "master") {
    return true;
  }
  return Boolean(
    accessdata.roll?.pos_price_discount_override &&
      String(accessdata.roll.pos_price_discount_override).includes("edit")
  );
}

function buildJobTypeTreeWithPrices(rows) {
  const byId = new Map();
  const roots = [];

  for (const r of rows || []) {
    byId.set(Number(r.id), {
      id: Number(r.id),
      store_id: Number(r.store_id) || 0,
      parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
      name: r.name || "",
      description: r.description || "",
      image: r.image || "",
      image_url: r.image ? `/uploads/job-types/${encodeURIComponent(path.basename(r.image))}` : "",
      pricedCount: Number(r.priced_count) || 0,
      children: [],
      depth: 0,
      breadcrumb: [],
    });
  }

  for (const node of byId.values()) {
    const parentNode = node.parent_id !== null ? byId.get(node.parent_id) : null;
    if (parentNode && parentNode.id !== node.id && parentNode.store_id === node.store_id) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortAndWalk(nodes, depth, ancestorTrail) {
    nodes.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    for (const node of nodes) {
      node.depth = depth;
      node.breadcrumb = [...ancestorTrail, { id: node.id, name: node.name }];
      sortAndWalk(node.children, depth + 1, node.breadcrumb);
    }
  }

  sortAndWalk(roots, 0, []);
  return roots;
}

function buildJobTypeBreadcrumb(rows, targetId) {
  const byId = new Map();
  for (const r of rows || []) {
    byId.set(Number(r.id), {
      id: Number(r.id),
      parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
      name: r.name || "",
    });
  }
  const chain = [];
  const visited = new Set();
  let cur = byId.get(Number(targetId));
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift({ id: cur.id, name: cur.name });
    cur = cur.parent_id !== null ? byId.get(cur.parent_id) : null;
  }
  return chain;
}

async function fetchStoreJobTypesTree(storeId) {
  const safeStoreId = Number(storeId) || 0;
  if (safeStoreId <= 0) return { rows: [], tree: [] };

  const rows = await mySqlQury(
    `SELECT jt.id, jt.store_id, jt.parent_id, jt.name, jt.description, jt.image, jt.status,
            COALESCE(p.priced_count, 0) AS priced_count
     FROM tbl_job_types jt
     LEFT JOIN (
       SELECT jp.job_type_id, COUNT(*) AS priced_count
       FROM tbl_job_item_prices jp
       INNER JOIN tbl_services s ON jp.service_id = s.id
       WHERE jp.store_id = ? AND jp.price > 0 AND s.store_ID = ? AND s.status = '0'
       GROUP BY jp.job_type_id
     ) p ON p.job_type_id = jt.id
     WHERE jt.store_id = ? AND LOWER(TRIM(jt.status)) = 'active'
     ORDER BY jt.name ASC, jt.id ASC`,
    [safeStoreId, String(safeStoreId), safeStoreId]
  );

  const tree = buildJobTypeTreeWithPrices(rows);
  return { rows, tree };
}

async function fetchPricedServicesForJobType(storeId, jobTypeId) {
  const safeStoreId = Number(storeId) || 0;
  const safeJtId = Number(jobTypeId) || 0;
  if (safeStoreId <= 0 || safeJtId <= 0) return [];

  const services = await mySqlQury(
    `SELECT s.*, jp.price AS job_item_price
     FROM tbl_services s
     INNER JOIN tbl_job_item_prices jp
       ON jp.service_id = s.id
      AND jp.job_type_id = ?
      AND jp.store_id = ?
      AND jp.price > 0
     WHERE s.store_ID = ? AND s.status = '0'
     ORDER BY s.sequence_no ASC, s.name ASC, s.id ASC`,
    [safeJtId, safeStoreId, String(safeStoreId)]
  );

  const posImageSize = await getEffectivePosImageSize(safeStoreId);
  await attachPosImageMeta(services, safeStoreId, posImageSize);
  return { services, posImageSize };
}

async function getOrCreateWalkInCustomer(storeId, req) {
  if (!storeId || storeId == "0" || storeId == "") return null;
  let walk = await DataFind(
    `SELECT * FROM tbl_customer WHERE store_ID = '${storeId}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`
  );
  if (walk && walk.length > 0) return walk[0];
  await DataInsert(
    `tbl_customer`,
    `name, store_ID, reffstore, approved, delet_flage`,
    `'Walk in customer', '${storeId}', '${storeId}', 1, 0`,
    req ? req.hostname : "",
    req ? req.protocol : ""
  );
  walk = await DataFind(
    `SELECT * FROM tbl_customer WHERE store_ID = '${storeId}' AND approved = 1 AND delet_flage = 0 AND (username IS NULL OR username = '' OR name LIKE '%Walk%in%') ORDER BY id ASC LIMIT 1`
  );
  return walk && walk.length > 0 ? walk[0] : null;
}

async function getStoreScopedCustomers(storeId, includeWalkIn = true) {
  if (!storeId || storeId == "0" || storeId == "") return [];
  const walkInFilter = includeWalkIn
    ? ""
    : " AND (tbl_customer.username IS NOT NULL AND tbl_customer.username != '' AND (tbl_customer.name NOT LIKE '%Walk%in%' OR tbl_customer.name IS NULL)) ";
  return await DataFind(`
    SELECT 
      tbl_customer.id, 
      tbl_customer.name, 
      tbl_customer.first_name, 
      tbl_customer.last_name, 
      tbl_customer.number, 
      tbl_customer.email, 
      tbl_customer.username, 
      tbl_customer.customer_type, 
      tbl_customer.address, 
      tbl_customer.city, 
      tbl_customer.state, 
      tbl_customer.zipcode, 
      tbl_customer.memo, 
      tbl_customer.taxnumber, 
      tbl_customer.communication_preference_id,
      tbl_customer.sms_opt_in,
      COALESCE(tbl_communication_preferences.code, 'not_set') AS communication_preference_code,
      COALESCE(tbl_communication_preferences.name, 'Not Set') AS communication_preference_name,
      tbl_store.name AS store_name,
      COALESCE(ord_stats.total_orders, 0) AS total_orders,
      COALESCE(ord_stats.unpaid_orders, 0) AS unpaid_orders,
      COALESCE(ord_stats.unpaid_amount, 0) AS unpaid_amount
    FROM tbl_customer
    LEFT JOIN tbl_store ON tbl_customer.store_ID = tbl_store.id
    LEFT JOIN tbl_communication_preferences ON tbl_customer.communication_preference_id = tbl_communication_preferences.id
    LEFT JOIN (
      SELECT 
        customer_id,
        COUNT(id) AS total_orders,
        COALESCE(SUM(CASE WHEN balance_amount > 0 THEN 1 ELSE 0 END), 0) AS unpaid_orders,
        COALESCE(SUM(CASE WHEN balance_amount > 0 THEN balance_amount ELSE 0 END), 0) AS unpaid_amount
      FROM tbl_order
      GROUP BY customer_id
    ) ord_stats ON ord_stats.customer_id = tbl_customer.id
    WHERE 
      tbl_customer.approved = 1 
      AND tbl_customer.delet_flage = 0 
      AND tbl_customer.store_ID = '${storeId}'
      ${walkInFilter}
    ORDER BY (CASE WHEN tbl_customer.username IS NULL OR tbl_customer.username = '' OR tbl_customer.name LIKE '%Walk%in%' THEN 0 ELSE 1 END), tbl_customer.name ASC
  `);
}

async function resolveUserStoreScope(req) {
  const { id, roll, store, loginas } = req.user;
  const accessdata = await access(req.user);

  if (accessdata.roll?.rollType === "customer" || loginas == 0) {
    const canRead = Boolean(accessdata.roll?.pos && accessdata.roll.pos.includes("read"));
    const customerData = await DataFind(
      `SELECT store_ID, reffstore FROM tbl_customer WHERE id = ${Number(id) || 0} LIMIT 1`
    );
    let resolvedStore =
      customerData.length > 0 && customerData[0].store_ID && String(customerData[0].store_ID) !== "0"
        ? Number(customerData[0].store_ID)
        : customerData.length > 0 && customerData[0].reffstore && String(customerData[0].reffstore) !== "0"
          ? Number(customerData[0].reffstore)
          : Number(store) || 0;
    if (!resolvedStore) {
      const defStore = await DataFind("SELECT id FROM tbl_store WHERE status=1 AND delete_flage=0 ORDER BY id ASC LIMIT 1");
      resolvedStore = defStore.length > 0 ? Number(defStore[0].id) : 1;
    }
    return { accessdata, isMaster: false, isCustomer: true, isStaff: false, assignedStoreId: resolvedStore, canRead };
  }

  const [adminData, rolldetail] = await Promise.all([
    mySqlQury("SELECT store_ID, is_staff FROM tbl_admin WHERE id = ? LIMIT 1", [id]),
    mySqlQury(
      `SELECT sr.*, r.roll_status, r.rollType
       FROM tbl_staff_roll sr
       JOIN tbl_roll r ON sr.main_roll_id = r.id
       WHERE sr.id = ? LIMIT 1`,
      [roll]
    ),
  ]);

  const a0 = adminData && adminData.length > 0 ? adminData[0] : {};
  const r0 = rolldetail && rolldetail.length > 0 ? rolldetail[0] : {};
  const canRead = Boolean(r0.pos && String(r0.pos).includes("read"));
  const isStaff = a0.is_staff !== undefined && String(a0.is_staff) !== "0";
  const isMaster =
    r0.rollType === "master" &&
    !isStaff &&
    (!a0.store_ID || String(a0.store_ID) === "0" || String(a0.store_ID).trim() === "");

  const assignedStoreId =
    a0.store_ID && String(a0.store_ID) !== "0" && String(a0.store_ID).trim() !== ""
      ? Number(a0.store_ID)
      : store && String(store) !== "0"
        ? Number(store)
        : 0;

  return { accessdata, isMaster, isCustomer: false, isStaff, assignedStoreId, canRead };
}

// =====================================================================
// GET /pos-2 — POS-2 Screen (Job-Type First Flow)
// =====================================================================
router.get("/", auth, async (req, res) => {
  try {
    const customer = await DataFind(`SELECT COUNT(*) AS tot_cus FROM tbl_customer`);
    if (customer[0].tot_cus == "0") {
      const customerInsert = await DataInsert(
        `tbl_customer`,
        `name, store_ID, reffstore, approved, delet_flage`,
        `'Walk in customer', '1', '1', '1', '0'`,
        req.hostname,
        req.protocol
      );
      if (customerInsert == -1) {
        req.flash("error", process.env.dataerror || "Failed to initialize default customer");
        return res.redirect("/dashboard");
      }
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    let orderid = await generateOrderId();
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
      isMaster = false,
      isDefaultCustomerEnabled = true;

    if (
      accessdata.roll.rollType == "customer" &&
      accessdata.roll.pos.includes("read")
    ) {
      login = "customer";
      const customerData = await DataFind(
        `SELECT tbl_customer.id, tbl_customer.name, tbl_customer.number, tbl_customer.email, tbl_customer.store_ID, tbl_customer.reffstore, tbl_customer.customer_type,
                tbl_customer.communication_preference_id, tbl_customer.sms_opt_in,
                COALESCE(tbl_communication_preferences.code, 'not_set') AS communication_preference_code,
                COALESCE(tbl_communication_preferences.name, 'Not Set') AS communication_preference_name
         FROM tbl_customer
         LEFT JOIN tbl_communication_preferences ON tbl_customer.communication_preference_id = tbl_communication_preferences.id
         WHERE tbl_customer.id = ${id}`
      );
      customerList =
        customerData.length > 0
          ? customerData
          : [{ id, name: "Customer", number: "", email: "", customer_type: "Counter • Counter" }];

      let resolvedStore =
        customerData.length > 0 && customerData[0].store_ID && String(customerData[0].store_ID) !== "0" && String(customerData[0].store_ID).trim() !== ""
          ? String(customerData[0].store_ID)
          : customerData.length > 0 && customerData[0].reffstore && String(customerData[0].reffstore) !== "0" && String(customerData[0].reffstore).trim() !== ""
            ? String(customerData[0].reffstore)
            : store && String(store) !== "0" && String(store).trim() !== ""
              ? String(store)
              : "";

      if (!resolvedStore) {
        const defaultStore = await DataFind(
          "SELECT id, name FROM tbl_store WHERE status=1 AND delete_flage=0 ORDER BY id ASC LIMIT 1"
        );
        resolvedStore = defaultStore.length > 0 ? String(defaultStore[0].id) : "1";
      }

      targetStoreId = resolvedStore;
      showStoreSelect = false;

      const storeDetails = await DataFind(
        `SELECT id, name, tax_percent FROM tbl_store WHERE id = '${targetStoreId}'`
      );
      assignedStoreName = storeDetails.length > 0 ? storeDetails[0].name : "Main Store";
      const taxValue = storeDetails.length > 0 ? storeDetails[0].tax_percent || 0 : 0;
      storeList = await DataFind(
        "SELECT id, name, override_rate_percent FROM tbl_store WHERE status=1 AND delete_flage=0"
      );

      const cartdata = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'"
      );

      if (cartdata.length > 0 && cartdata[0].order_id && String(cartdata[0].store_id) === String(targetStoreId)) {
        orderid = cartdata[0].order_id;
      } else {
        orderid = await generateOrderId(targetStoreId);
      }

      if (cartdata.length > 0) {
        const currentCartStore = String(cartdata[0].store_id || "0");
        if (currentCartStore !== String(targetStoreId)) {
          if (cartdata[0].service_list_id && cartdata[0].service_list_id !== "0") {
            const oldIds = cartdata[0].service_list_id.split(",").filter((x) => x && x !== "0").join(",");
            if (oldIds) {
              await DataDelete("tbl_cart_servicelist", `id IN (${oldIds})`, req.hostname, req.protocol);
            }
          }
          await DataUpdate(
            `tbl_cart`,
            `order_id='${orderid}', store_id='${targetStoreId}', customer_id='${id}', tax='${taxValue}', job_type_id=NULL, service_list_id='0', sub_total=0, addon_id=0, addon_price=0, extra_discount=0, coupon_id=0, coupon_discount=0, tax_amount=0, gross_total=0, paid_amount=0, balance=0`,
            `created_by='${loginas},${id}'`,
            req.hostname,
            req.protocol
          );
        } else {
          await DataUpdate(
            `tbl_cart`,
            `order_id='${orderid}', tax='${taxValue}', store_id='${targetStoreId}', customer_id='${id}'`,
            `created_by='${loginas},${id}'`,
            req.hostname,
            req.protocol
          );
        }
      } else {
        await DataInsert(
          `tbl_cart`,
          `created_by, store_id, customer_id, order_id, tax`,
          `'${loginas},${id}', '${targetStoreId}', ${id}, '${orderid}', '${taxValue}'`,
          req.hostname,
          req.protocol
        );
      }

      cart = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'"
      );
      addonlist = await DataFind(
        "SELECT * FROM tbl_addons WHERE status=0 AND store_ID=" + targetStoreId
      );

      if (cart.length > 0 && cart[0].service_list_id && cart[0].service_list_id !== "0") {
        cartservice = await DataFind(
          "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
            cart[0].service_list_id +
            "')"
        );
      }
    } else {
      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`
      );
      isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
      const assignedStore =
        adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID) !== "0"
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
        rolldetail.length > 0 &&
        rolldetail[0].rollType === "master" &&
        !isStaff &&
        (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === "0");

      const multiy = await DataFind("SELECT type, customer_selection FROM tbl_master_shop");
      ismulty = multiy[0].type == 1;
      storeList = await DataFind(
        "SELECT id, name, override_rate_percent FROM tbl_store WHERE status=1 AND delete_flage=0"
      );

      if (isMaster) {
        showStoreSelect = true;
        login = "master";
        targetStoreId = 0;
      } else {
        showStoreSelect = false;
        login = "store";
        targetStoreId = assignedStore;
        staffStoreId = assignedStore;
        if (assignedStore) {
          const sName = await DataFind(`SELECT name FROM tbl_store WHERE id = '${assignedStore}'`);
          if (sName.length > 0) {
            assignedStoreName = sName[0].name;
            staffStoreName = sName[0].name;
          }
        }
      }

      let taxVal = 0;
      if (targetStoreId && targetStoreId != 0) {
        const taxData = await DataFind("SELECT tax_percent FROM tbl_store WHERE id=" + targetStoreId);
        taxVal = taxData.length > 0 ? taxData[0].tax_percent : 0;
      }

      const cartdata = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'"
      );

      // For Master Admin who already has an active cart with items + store_id, preserve store on refresh
      if (isMaster && cartdata.length > 0 && cartdata[0].store_id && String(cartdata[0].store_id) !== "0" && cartdata[0].service_list_id && String(cartdata[0].service_list_id) !== "0") {
        targetStoreId = String(cartdata[0].store_id);
        const taxData = await DataFind("SELECT tax_percent FROM tbl_store WHERE id=" + targetStoreId);
        taxVal = taxData.length > 0 ? taxData[0].tax_percent : 0;
      }

      if (cartdata.length > 0 && cartdata[0].order_id && String(cartdata[0].store_id) === String(targetStoreId)) {
        orderid = cartdata[0].order_id;
      } else if (targetStoreId && targetStoreId != 0) {
        orderid = await generateOrderId(targetStoreId);
      }

      if (cartdata.length > 0) {
        const storeChanged = String(cartdata[0].store_id || "0") !== String(targetStoreId);
        await DataUpdate(
          `tbl_cart`,
          `order_id='${orderid}', store_id='${targetStoreId}', tax=${taxVal}${storeChanged ? ", job_type_id=NULL" : ""}`,
          `created_by='${loginas},${id}'`,
          req.hostname,
          req.protocol
        );
      } else {
        await DataInsert(
          `tbl_cart`,
          `created_by, order_id, store_id, tax, customer_id`,
          `'${loginas},${id}', '${orderid}', '${targetStoreId}', ${taxVal}, '0'`,
          req.hostname,
          req.protocol
        );
      }

      cart = await DataFind(
        "SELECT * FROM tbl_cart WHERE created_by='" + loginas + "," + id + "'"
      );

      if (targetStoreId && targetStoreId != 0) {
        const storeCheck = await DataFind(
          `SELECT default_customer_enabled FROM tbl_store WHERE id = '${targetStoreId}'`
        );
        if (
          storeCheck.length > 0 &&
          (storeCheck[0].default_customer_enabled == 0 || storeCheck[0].default_customer_enabled === "0")
        ) {
          isDefaultCustomerEnabled = false;
        }
      }

      if (!isMaster && targetStoreId && targetStoreId != 0) {
        if (isDefaultCustomerEnabled) {
          const walkinCustomer = await getOrCreateWalkInCustomer(targetStoreId, req);
          if (walkinCustomer) {
            await DataUpdate(
              `tbl_cart`,
              `customer_id='${walkinCustomer.id}'`,
              `created_by='${loginas},${id}'`,
              req.hostname,
              req.protocol
            );
            cart[0].customer_id = walkinCustomer.id;
          }
        } else if (cart[0].customer_id && cart[0].customer_id != 0) {
          const currentCus = await DataFind(
            `SELECT id, username, name FROM tbl_customer WHERE id = '${cart[0].customer_id}'`
          );
          if (
            currentCus.length > 0 &&
            (currentCus[0].username == null ||
              currentCus[0].username === "" ||
              (currentCus[0].name && currentCus[0].name.toLowerCase().includes("walk in")))
          ) {
            await DataUpdate(
              `tbl_cart`,
              `customer_id='0'`,
              `created_by='${loginas},${id}'`,
              req.hostname,
              req.protocol
            );
            cart[0].customer_id = 0;
          }
        }
      }

      if (targetStoreId && targetStoreId != 0) {
        customerList = await getStoreScopedCustomers(targetStoreId, isDefaultCustomerEnabled);
        addonlist = await DataFind("SELECT * FROM tbl_addons WHERE status=0 AND store_ID=" + targetStoreId);
        if (cart[0].service_list_id && cart[0].service_list_id !== "0") {
          cartservice = await DataFind(
            "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
              cart[0].service_list_id +
              "')"
          );
        }
      }
    }

    if (!cart || cart.length === 0) {
      return res.status(400).send("Cart not found");
    }

    orderid = cart[0].order_id;
    const splite_id = orderid.split(/[A-Za-z]/).join("");

    const readySchedule = await getEffectiveReadySchedule(targetStoreId);
    let storePrinterConfig = null;
    let overrideRatePercent = 10;
    if (targetStoreId && targetStoreId != 0) {
      const spRows = await DataFind(
        `SELECT printing_server_url, invoice_printer_name, invoice_printer_format, tag_printer_name, tag_printer_format, silent_print_enabled, printer_auto_cut, printer_open_cash_drawer, printer_copies, override_rate_percent FROM tbl_store WHERE id = '${targetStoreId}' LIMIT 1`
      );
      if (spRows.length > 0) {
        storePrinterConfig = spRows[0];
        if (spRows[0].override_rate_percent !== undefined && spRows[0].override_rate_percent !== null) {
          overrideRatePercent = parseFloat(spRows[0].override_rate_percent);
        }
      }
    }

    if (
      !cart[0].delivery_date ||
      String(cart[0].delivery_date).slice(0, 10) === String(cart[0].order_date).slice(0, 10)
    ) {
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

    const customer_types = await DataFind("SELECT * FROM tbl_customer_type WHERE status = 1 ORDER BY id ASC");
    const communication_preferences = await DataFind(
      "SELECT * FROM tbl_communication_preferences WHERE status = 1 ORDER BY sort_order ASC"
    ).catch(() => []);

    // POS-2 Specific: Load Job Types Tree & Priced Services for Active Job Type
    const posImageSize = await getEffectivePosImageSize(targetStoreId);
    let jobTypeRows = [];
    let jobTypeTree = [];
    let activeJobType = null;
    let activeJobTypeBreadcrumb = [];

    if (targetStoreId && Number(targetStoreId) > 0) {
      const jtBundle = await fetchStoreJobTypesTree(targetStoreId);
      jobTypeRows = jtBundle.rows;
      jobTypeTree = jtBundle.tree;

      const cartJtId = cart[0].job_type_id ? Number(cart[0].job_type_id) : 0;
      if (cartJtId > 0) {
        const matched = jobTypeRows.find((r) => Number(r.id) === cartJtId);
        if (matched) {
          activeJobType = {
            id: Number(matched.id),
            name: matched.name,
            pricedCount: Number(matched.priced_count) || 0,
            store_id: Number(matched.store_id),
          };
          activeJobTypeBreadcrumb = buildJobTypeBreadcrumb(jobTypeRows, cartJtId);
          const pricedResult = await fetchPricedServicesForJobType(targetStoreId, cartJtId);
          service_list = pricedResult.services || [];
        } else {
          // Stale job_type_id from another store or deleted/inactive job type
          await mySqlQury("UPDATE tbl_cart SET job_type_id = NULL WHERE created_by = ?", [`${loginas},${id}`]);
          cart[0].job_type_id = null;
        }
      }
    }

    // Always open the Job Type modal when POS-2 is opened fresh (empty cart) or no valid Job Type is active
    const shouldOpenJobTypeModal = !activeJobType || cartservice.length === 0;
    const genderList = await getActiveGenders();

    return res.render("pos", {
      isPos2: true,
      posBaseUrl: "/pos-2",
      genderList,
      jobTypeTree,
      activeJobType,
      activeJobTypeBreadcrumb,
      shouldOpenJobTypeModal,
      posImageSize,
      storePrinterConfig,
      overrideRatePercent,
      canOverridePriceDiscount: canOverridePosPriceDiscount(accessdata),
      login,
      storeList,
      customer_types,
      communication_preferences: communication_preferences || [],
      service_list,
      categoryList: [],
      subcategoryList: [],
      ismulty,
      customerList,
      addonlist,
      cartservice,
      cart: cart[0],
      accessdata,
      readySchedule,
      isStaff,
      staffStoreId,
      staffStoreName,
      showStoreSelect,
      assignedStoreId: targetStoreId,
      assignedStoreName,
      isMaster,
      isDefaultCustomerEnabled,
      language: req.language_data,
      language_name: req.language_name,
      splite_id,
    });
  } catch (error) {
    console.error("Error in GET /pos-2:", error);
    return res.status(500).send("Internal Server Error");
  }
});

// =====================================================================
// GET /pos-2/job-types/:storeId — Fetch Active Job Types Tree w/ Counts
// =====================================================================
router.get("/job-types/:storeId", auth, async (req, res) => {
  try {
    const scope = await resolveUserStoreScope(req);
    if (!scope.canRead) {
      return res.status(403).json({ success: false, message: "Not authorized.", jobTypeTree: [] });
    }

    const targetStoreId = scope.isMaster
      ? Number(req.params.storeId) || 0
      : scope.assignedStoreId;

    if (!Number.isInteger(targetStoreId) || targetStoreId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid store ID.", jobTypeTree: [] });
    }

    const { tree } = await fetchStoreJobTypesTree(targetStoreId);
    return res.status(200).json({
      success: true,
      store_id: targetStoreId,
      jobTypeTree: tree,
    });
  } catch (error) {
    console.error("Error in GET /pos-2/job-types/:storeId:", error);
    return res.status(500).json({ success: false, message: "Failed to load job types.", jobTypeTree: [] });
  }
});

// =====================================================================
// POST /pos-2/select-job-type — Confirm Job Type & Load Priced Services
// =====================================================================
router.post("/select-job-type", auth, async (req, res) => {
  try {
    const { id, loginas } = req.user;
    const scope = await resolveUserStoreScope(req);
    if (!scope.canRead) {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    const jobTypeId = Number(req.body.job_type_id);
    if (!Number.isInteger(jobTypeId) || jobTypeId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a valid Job Type." });
    }

    const jtRows = await mySqlQury(
      "SELECT id, store_id, parent_id, name, status FROM tbl_job_types WHERE id = ? LIMIT 1",
      [jobTypeId]
    );
    if (!jtRows || jtRows.length === 0) {
      return res.status(404).json({ success: false, message: "Job Type not found." });
    }

    const jt = jtRows[0];
    if (String(jt.status || "").trim().toLowerCase() !== "active") {
      return res.status(400).json({ success: false, message: "Selected Job Type is inactive." });
    }

    const targetStoreId = Number(jt.store_id);
    if (!scope.isMaster && targetStoreId !== scope.assignedStoreId) {
      return res.status(403).json({ success: false, message: "Selected Job Type belongs to another store." });
    }

    const { services, posImageSize } = await fetchPricedServicesForJobType(targetStoreId, jobTypeId);
    if (!services || services.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No priced items configured for "${jt.name}". Please set item prices first.`,
      });
    }

    const createdByKey = `${loginas},${id}`;
    const cartRows = await mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]);
    if (!cartRows || cartRows.length === 0) {
      return res.status(400).json({ success: false, message: "Active cart not found. Please reload POS-2." });
    }

    const cartRow = cartRows[0];
    const existingIds = String(cartRow.service_list_id || "")
      .split(",")
      .map((x) => x.trim())
      .filter((x) => x && x !== "0");
    const hasCartItems = existingIds.length > 0;
    const isDifferentJobType = Number(cartRow.job_type_id || 0) !== jobTypeId;
    const clearRequested =
      req.body.clear_cart === true ||
      String(req.body.clear_cart || "").toLowerCase() === "true" ||
      String(req.body.clear_cart || "") === "1";

    if (hasCartItems && isDifferentJobType && !clearRequested) {
      return res.status(409).json({
        success: false,
        requiresClear: true,
        message: "Your cart has items from another Job Type. Clear the cart to switch?",
      });
    }

    let cartCleared = false;
    if (hasCartItems && clearRequested) {
      await mySqlQury("DELETE FROM tbl_cart_servicelist WHERE id IN (?)", [existingIds.map(Number)]);
      await mySqlQury(
        `UPDATE tbl_cart
         SET service_list_id = '0',
             addon_id = '0',
             addon_price = 0,
             extra_discount = 0,
             coupon_id = '0',
             coupon_discount = 0,
             sub_total = 0,
             tax_amount = 0,
             gross_total = 0,
             paid_amount = 0,
             balance = 0,
             job_type_id = ?
         WHERE created_by = ?`,
        [jobTypeId, createdByKey]
      );
      cartCleared = true;
    } else {
      await mySqlQury(
        "UPDATE tbl_cart SET job_type_id = ? WHERE created_by = ?",
        [jobTypeId, createdByKey]
      );
    }

    const [{ rows: storeJtRows }, updatedCartRows] = await Promise.all([
      fetchStoreJobTypesTree(targetStoreId),
      mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]),
    ]);

    const updatedCart = updatedCartRows[0];
    let updatedCartService = [];
    if (updatedCart && updatedCart.service_list_id && String(updatedCart.service_list_id) !== "0") {
      updatedCartService = await DataFind(
        "SELECT * FROM tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
          updatedCart.service_list_id +
          "')"
      );
    }

    const breadcrumb = buildJobTypeBreadcrumb(storeJtRows, jobTypeId);

    return res.status(200).json({
      success: true,
      cartCleared,
      activeJobType: {
        id: jobTypeId,
        name: jt.name,
        store_id: targetStoreId,
        pricedCount: services.length,
      },
      breadcrumb,
      service_list: services,
      pos_image_size: posImageSize,
      cart: updatedCart,
      cartservice: updatedCartService,
      loginas,
    });
  } catch (error) {
    console.error("Error in POST /pos-2/select-job-type:", error);
    return res.status(500).json({ success: false, message: "Failed to select Job Type." });
  }
});

// =====================================================================
// POST /pos-2/direct-add — Direct One-Click Add to Cart w/ DB Price
// =====================================================================
router.post("/direct-add", auth, async (req, res) => {
  try {
    const { id, loginas } = req.user;
    const scope = await resolveUserStoreScope(req);
    if (!scope.canRead) {
      return res.status(403).json({ success: false, message: "Not authorized." });
    }

    const serviceId = Number(req.body.service_id);
    if (!Number.isInteger(serviceId) || serviceId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid service item." });
    }

    const createdByKey = `${loginas},${id}`;
    const cartRows = await mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]);
    if (!cartRows || cartRows.length === 0) {
      return res.status(400).json({ success: false, message: "Active cart not found." });
    }

    const cartRow = cartRows[0];
    const targetStoreId = scope.isMaster ? Number(cartRow.store_id) || 0 : scope.assignedStoreId;
    if (targetStoreId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a store first." });
    }

    const jobTypeId = Number(req.body.job_type_id) || Number(cartRow.job_type_id) || 0;
    if (jobTypeId <= 0) {
      return res.status(400).json({ success: false, message: "Please select a Job Type first." });
    }

    // Authoritatively look up service + price + job type from DB (never trust client price)
    const pricedRows = await mySqlQury(
      `SELECT jp.price,
              s.id AS service_id, s.name AS service_name, s.image AS service_img, s.no_of_items,
              jt.id AS job_type_id, jt.name AS job_type_name
       FROM tbl_job_item_prices jp
       INNER JOIN tbl_services s ON jp.service_id = s.id
       INNER JOIN tbl_job_types jt ON jp.job_type_id = jt.id
       WHERE jp.job_type_id = ?
         AND jp.service_id = ?
         AND jp.store_id = ?
         AND jp.price > 0
         AND s.store_ID = ?
         AND s.status = '0'
         AND LOWER(TRIM(jt.status)) = 'active'
       LIMIT 1`,
      [jobTypeId, serviceId, targetStoreId, String(targetStoreId)]
    );

    if (!pricedRows || pricedRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "This service item does not have a valid price configured for the selected Job Type.",
      });
    }

    const item = pricedRows[0];
    const itemPrice = Number(Number(item.price).toFixed(2));
    const servicePieces = parseInt(item.no_of_items, 10) > 0 ? parseInt(item.no_of_items, 10) : 1;

    // Check if this service item (for the active job type) is already in the cart -> increment qty
    const existingIds = String(cartRow.service_list_id || "")
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isInteger(n) && n > 0);

    let existingMatch = null;
    if (existingIds.length > 0) {
      const placeholders = existingIds.map(() => "?").join(",");
      const matchRows = await mySqlQury(
        `SELECT * FROM tbl_cart_servicelist
         WHERE id IN (${placeholders})
           AND service_id = ?
           AND service_type_id = ?
         ORDER BY id DESC
         LIMIT 1`,
        [...existingIds, String(item.service_id), String(item.job_type_id)]
      );
      if (matchRows && matchRows.length > 0) {
        existingMatch = matchRows[0];
      }
    }

    let targetRowId;
    let newQuantity = 1;
    let priceDelta = itemPrice;
    let wasIncremented = false;

    if (existingMatch) {
      targetRowId = existingMatch.id;
      newQuantity = (parseInt(existingMatch.service_quntity, 10) || 1) + 1;
      priceDelta = Number(Number(existingMatch.service_type_price || itemPrice).toFixed(2));
      wasIncremented = true;

      await mySqlQury(
        `UPDATE tbl_cart_servicelist
         SET service_quntity = ?
         WHERE id = ?`,
        [newQuantity, targetRowId]
      );

      await mySqlQury(
        `UPDATE tbl_cart
         SET job_type_id = ?,
             sub_total = ROUND(sub_total + ?, 2),
             tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (COALESCE(tax, 0) / 100), 2),
             gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
             balance = ROUND(gross_total - paid_amount, 2)
         WHERE created_by = ?`,
        [jobTypeId, priceDelta, createdByKey]
      );
    } else {
      const insertResult = await mySqlQury(
        `INSERT INTO tbl_cart_servicelist
           (service_id, service_type_id, service_type_price, original_rate, item_value,
            service_quntity, service_color, service_name, service_type_name, service_img,
            no_of_items, garment_pattern, gender)
         VALUES (?, ?, ?, ?, 0, 1, '#000000', ?, ?, ?, ?, 'Solid', 'None')`,
        [
          String(item.service_id),
          String(item.job_type_id),
          itemPrice,
          itemPrice,
          item.service_name || "",
          item.job_type_name || "",
          item.service_img || "default.png",
          servicePieces,
        ]
      );

      targetRowId = insertResult.insertId;

      await mySqlQury(
        `UPDATE tbl_cart
         SET job_type_id = ?,
             service_list_id = CONCAT(service_list_id, ',', ?),
             sub_total = ROUND(sub_total + ?, 2),
             tax_amount = ROUND((sub_total + addon_price - coupon_discount - extra_discount) * (COALESCE(tax, 0) / 100), 2),
             gross_total = ROUND(sub_total + tax_amount + addon_price - coupon_discount - extra_discount, 2),
             balance = ROUND(gross_total - paid_amount, 2)
         WHERE created_by = ?`,
        [jobTypeId, targetRowId, priceDelta, createdByKey]
      );
    }

    const updatedCartRows = await mySqlQury("SELECT * FROM tbl_cart WHERE created_by = ? LIMIT 1", [createdByKey]);
    const updatedCart = updatedCartRows[0];
    const cartservice = await DataFind(
      "SELECT * FROM tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        updatedCart.service_list_id +
        "')"
    );

    return res.status(200).json({
      success: true,
      cart: updatedCart,
      cartservice,
      loginas,
      addedItem: {
        id: targetRowId,
        service_id: item.service_id,
        service_name: item.service_name,
        job_type_name: item.job_type_name,
        price: priceDelta,
        quantity: newQuantity,
        incremented: wasIncremented,
      },
    });
  } catch (error) {
    console.error("Error in POST /pos-2/direct-add:", error);
    return res.status(500).json({ success: false, message: "Failed to add item to cart." });
  }
});

router._helpers = {
  buildJobTypeTreeWithPrices,
  buildJobTypeBreadcrumb,
  fetchStoreJobTypesTree,
  fetchPricedServicesForJobType,
};

module.exports = router;
