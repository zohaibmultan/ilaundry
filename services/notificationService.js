/**
 * Centralized Customer Notification Service (Email, SMS & Push)
 * Supports two-tier configuration (Global defaults + Per-store overrides)
 * and dispatches notifications across all 12 customer lifecycle events.
 */
const nodemailer = require("nodemailer");
const sendNotification = require("../middelwer/send");
const { DataFind, DataInsert, DataUpdate } = require("../middelwer/databaseQurey");
const { conn } = require("../middelwer/db");

let tableVerified = false;

async function ensureSettingsTable() {
  if (tableVerified) return;
  try {
    const promiseConn = conn.promise();
    await promiseConn.query(`
      CREATE TABLE IF NOT EXISTS tbl_notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id INT NOT NULL DEFAULT 0,
        email_enabled TINYINT(1) NOT NULL DEFAULT 1,
        sms_enabled TINYINT(1) NOT NULL DEFAULT 1,
        push_enabled TINYINT(1) NOT NULL DEFAULT 1,
        events_config LONGTEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_notif_store_id (store_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tableVerified = true;
  } catch (e) {
    console.error("Warning: ensureSettingsTable failed:", e.message);
  }
}

/**
 * Master catalog of all 12 Customer Notification Events
 */
const NOTIFICATION_EVENTS = [
  // Category 1: Order Intake & Placement
  {
    key: "order_placed",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Order Placed (Counter Drop-Off)",
    triggerBadge: "POS Save / Print",
    description: "Sent immediately when a new order is placed at the counter with itemized summary, gross total, paid amount, balance due, and estimated ready date.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, thank you for your order #{order_id} at {store_name}! Total: {gross_total} (Balance: {balance_due}). Ready by: {ready_date}."
  },
  {
    key: "route_pickup_scheduled",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Route Pick-up Scheduled (R & R / R & C)",
    triggerBadge: "Route Order Intake",
    description: "Sent when a Route Pick-up order (including 0-item pending intake) is scheduled, confirming the pickup date and 1-hour driver time slot.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, your garment pick-up (#{order_id}) with {store_name} is scheduled for {pickup_date}. Our driver will collect your items during this window."
  },
  {
    key: "route_intake_priced",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Garments Inspected & Priced (Post Route Pick-up)",
    triggerBadge: "Pending Intake Itemized",
    description: "Sent when a 0-item route pick-up order is inspected, counted, and priced at the store, providing the customer with the itemized list and total.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, we have inspected & itemized your picked-up garments for Order #{order_id} ({total_pieces} pcs). Total: {gross_total}. Target ready date: {ready_date}."
  },
  {
    key: "order_modified",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Order Modified / Updated",
    triggerBadge: "Order Edited",
    description: "Sent when items, quantities, or totals are updated on an existing order.",
    defaultEmail: true,
    defaultSms: false,
    sampleSms: "Hi {customer_name}, your Order #{order_id} at {store_name} has been updated. Revised Total: {gross_total} (Balance Due: {balance_due})."
  },

  // Category 2: Cleaning & Processing Lifecycle
  {
    key: "order_processing",
    category: "processing",
    categoryTitle: "2. Cleaning & Processing Lifecycle",
    categoryIcon: "fa-sync-alt",
    title: "Order In Process",
    triggerBadge: "Status: Processing",
    description: "Sent when order status moves to Processing, reassuring the customer that their garments are being cleaned.",
    defaultEmail: true,
    defaultSms: false,
    sampleSms: "Hi {customer_name}, your Order #{order_id} is now in cleaning process at {store_name}. Estimated completion: {ready_date}."
  },
  {
    key: "schedule_rescheduled",
    category: "processing",
    categoryTitle: "2. Cleaning & Processing Lifecycle",
    categoryIcon: "fa-sync-alt",
    title: "Ready / Delivery Schedule Rescheduled",
    triggerBadge: "Schedule Updated",
    description: "Sent when the Ready Schedule or Route Delivery Date/Time is changed on an active order.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, the schedule for your Order #{order_id} at {store_name} has been updated. New Ready/Delivery schedule: {ready_date}."
  },

  // Category 3: Ready for Pickup & Route Delivery
  {
    key: "order_ready_pickup",
    category: "ready",
    categoryTitle: "3. Ready for Pickup & Route Delivery",
    categoryIcon: "fa-check-double",
    title: "Order Ready for Counter Pickup (C & C / R & C)",
    triggerBadge: "Status: Ready (Counter)",
    description: "Sent when a Counter Pickup order is marked Ready, including total garment pieces, store address/phone, and remaining balance due.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Good news {customer_name}! Your Order #{order_id} ({total_pieces} pcs) at {store_name} is clean and READY for pickup. Balance Due: {balance_due}."
  },
  {
    key: "order_out_for_delivery",
    category: "ready",
    categoryTitle: "3. Ready for Pickup & Route Delivery",
    categoryIcon: "fa-check-double",
    title: "Out for Route Delivery (C & R / R & R)",
    triggerBadge: "Status: Ready / En Route",
    description: "Sent when a Route Delivery order is marked Ready or Out for Delivery, notifying the customer of the scheduled delivery window and balance due.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} pcs) are ready and scheduled for delivery on {delivery_date}. Balance Due: {balance_due}."
  },
  {
    key: "order_delivered",
    category: "ready",
    categoryTitle: "3. Ready for Pickup & Route Delivery",
    categoryIcon: "fa-check-double",
    title: "Order Completed / Delivered",
    triggerBadge: "Status: Delivered",
    description: "Sent when the customer picks up their garments or the driver completes delivery, providing a final digital receipt.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Thank you {customer_name}! Your Order #{order_id} from {store_name} has been completed and delivered. We appreciate your business!"
  },

  // Category 4: Payment, Cancellation & Account Lifecycle
  {
    key: "payment_received",
    category: "billing",
    categoryTitle: "4. Payment, Cancellation & Customer Account",
    categoryIcon: "fa-credit-card",
    title: "Payment Received (Full or Partial)",
    triggerBadge: "Add Payment Modal",
    description: "Sent when a payment is recorded against an order via the Add Payment modal, showing amount paid, payment method, and remaining balance.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Payment confirmed! We received {paid_now} for Order #{order_id} at {store_name}. Remaining Balance: {balance_due}. Thank you!"
  },
  {
    key: "order_cancelled",
    category: "billing",
    categoryTitle: "4. Payment, Cancellation & Customer Account",
    categoryIcon: "fa-credit-card",
    title: "Order Voided / Cancelled",
    triggerBadge: "Void / Cancelled",
    description: "Sent when an order is voided from POS or marked as Cancelled, including the cancellation reason.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled/voided ({cancel_reason}). Contact us at {store_phone} if you have questions."
  },
  {
    key: "welcome_customer",
    category: "billing",
    categoryTitle: "4. Payment, Cancellation & Customer Account",
    categoryIcon: "fa-credit-card",
    title: "Welcome New Customer",
    triggerBadge: "Customer Registration",
    description: "Sent when a new customer profile is registered at the store or via POS, welcoming them with store contact information.",
    defaultEmail: true,
    defaultSms: true,
    sampleSms: "Welcome to {store_name}, {customer_name}! Your customer account is ready. Call us anytime at {store_phone} for dry cleaning & laundry service."
  }
];

function getDefaultEventsMap() {
  const map = {};
  NOTIFICATION_EVENTS.forEach((ev) => {
    map[ev.key] = {
      email: Boolean(ev.defaultEmail),
      sms: Boolean(ev.defaultSms)
    };
  });
  return map;
}

function mergeEventsConfig(rawJson, fallbackMap) {
  const base = fallbackMap ? JSON.parse(JSON.stringify(fallbackMap)) : getDefaultEventsMap();
  if (!rawJson) return base;
  try {
    const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    if (parsed && typeof parsed === "object") {
      NOTIFICATION_EVENTS.forEach((ev) => {
        if (parsed[ev.key] && typeof parsed[ev.key] === "object") {
          base[ev.key] = {
            email: parsed[ev.key].email !== undefined ? Boolean(parsed[ev.key].email) : base[ev.key].email,
            sms: parsed[ev.key].sms !== undefined ? Boolean(parsed[ev.key].sms) : base[ev.key].sms
          };
        }
      });
    }
  } catch (e) {
    // ignore malformed json
  }
  return base;
}

/**
 * Resolve effective notification settings for a store (with fallback to store_id = 0 global settings)
 */
async function getEffectiveNotificationSettings(storeId = 0) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;

  const globalRows = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = 0 LIMIT 1`);
  const globalRow = globalRows && globalRows.length > 0 ? globalRows[0] : null;
  const globalEvents = mergeEventsConfig(globalRow ? globalRow.events_config : null, getDefaultEventsMap());

  let globalSettings = {
    store_id: 0,
    is_custom_store_override: false,
    email_enabled: globalRow ? Number(globalRow.email_enabled) === 1 : true,
    sms_enabled: globalRow ? Number(globalRow.sms_enabled) === 1 : true,
    push_enabled: globalRow ? Number(globalRow.push_enabled) === 1 : true,
    events: globalEvents
  };

  if (cleanStoreId === 0) {
    return globalSettings;
  }

  const storeRows = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);
  if (!storeRows || storeRows.length === 0) {
    return {
      ...globalSettings,
      store_id: cleanStoreId,
      is_custom_store_override: false
    };
  }

  const sRow = storeRows[0];
  return {
    store_id: cleanStoreId,
    is_custom_store_override: true,
    email_enabled: Number(sRow.email_enabled) === 1,
    sms_enabled: Number(sRow.sms_enabled) === 1,
    push_enabled: Number(sRow.push_enabled) === 1,
    events: mergeEventsConfig(sRow.events_config, globalEvents)
  };
}

/**
 * Save notification settings for storeId (0 = Global Master, >0 = Store Override)
 */
async function saveNotificationSettings(storeId, bodyData, req) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;

  const emailEnabled = (bodyData.email_enabled == "1" || bodyData.email_enabled === "on" || bodyData.email_enabled === true) ? 1 : 0;
  const smsEnabled = (bodyData.sms_enabled == "1" || bodyData.sms_enabled === "on" || bodyData.sms_enabled === true) ? 1 : 0;
  const pushEnabled = (bodyData.push_enabled == "1" || bodyData.push_enabled === "on" || bodyData.push_enabled === true) ? 1 : 0;

  const eventsMap = {};
  NOTIFICATION_EVENTS.forEach((ev) => {
    const emailField = `event_${ev.key}_email`;
    const smsField = `event_${ev.key}_sms`;
    eventsMap[ev.key] = {
      email: (bodyData[emailField] == "1" || bodyData[emailField] === "on" || bodyData[emailField] === true),
      sms: (bodyData[smsField] == "1" || bodyData[smsField] === "on" || bodyData[smsField] === true)
    };
  });

  const jsonStr = JSON.stringify(eventsMap).replace(/'/g, "\\'");
  const existing = await DataFind(`SELECT id FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);

  if (existing && existing.length > 0) {
    await DataUpdate(
      "tbl_notification_settings",
      `email_enabled = ${emailEnabled}, sms_enabled = ${smsEnabled}, push_enabled = ${pushEnabled}, events_config = '${jsonStr}'`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  } else {
    await DataInsert(
      "tbl_notification_settings",
      `store_id, email_enabled, sms_enabled, push_enabled, events_config`,
      `${cleanStoreId}, ${emailEnabled}, ${smsEnabled}, ${pushEnabled}, '${jsonStr}'`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  }
  return true;
}

/**
 * Save Email (SMTP) and Twilio (SMS) Gateway Settings for storeId (0 = Global Master, >0 = Store)
 */
async function saveEmailAndTwilioGateways(storeId, bodyData, req) {
  const cleanStoreId = parseInt(storeId, 10) || 0;
  const host = bodyData.smtp_host !== undefined ? bodyData.smtp_host : bodyData.host;
  const port = bodyData.smtp_port !== undefined ? bodyData.smtp_port : bodyData.port;
  const username = bodyData.smtp_username !== undefined ? bodyData.smtp_username : bodyData.username;
  const password = bodyData.smtp_password !== undefined ? bodyData.smtp_password : bodyData.password;
  const frommail = bodyData.smtp_frommail !== undefined ? bodyData.smtp_frommail : bodyData.frommail;
  const smtpStatusRaw = bodyData.smtp_status !== undefined ? bodyData.smtp_status : bodyData.status;

  // 1. Save Email (SMTP) settings into tbl_email if SMTP fields are present in form
  if (
    host !== undefined ||
    port !== undefined ||
    username !== undefined ||
    password !== undefined ||
    frommail !== undefined
  ) {
    const safeHost = String(host || "").trim().replace(/'/g, "\\'");
    const safePort = String(port || "587").trim().replace(/'/g, "\\'");
    const safeUser = String(username || "").trim().replace(/'/g, "\\'");
    const safePass = String(password || "").trim().replace(/'/g, "\\'");
    const safeFrom = String(frommail || "").trim().replace(/'/g, "\\'");
    const safeStatus = (smtpStatusRaw === "0" || smtpStatusRaw === 0 || smtpStatusRaw === false) ? "0" : "1";

    const existingMail = await DataFind(`SELECT id FROM tbl_email WHERE store_id = '${cleanStoreId}' LIMIT 1`);
    if (existingMail && existingMail.length > 0) {
      await DataUpdate(
        "tbl_email",
        `host='${safeHost}', port='${safePort}', username='${safeUser}', password='${safePass}', frommail='${safeFrom}', status='${safeStatus}'`,
        `store_id='${cleanStoreId}'`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    } else {
      await DataInsert(
        "tbl_email",
        `host, port, username, password, frommail, status, store_id`,
        `'${safeHost}', '${safePort}', '${safeUser}', '${safePass}', '${safeFrom}', '${safeStatus}', ${cleanStoreId}`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    }
  }

  // 2. Save Twilio (SMS) settings into tbl_store (if storeId > 0) or tbl_master_shop (if storeId === 0)
  if (
    bodyData.twilio_sid !== undefined ||
    bodyData.twilio_auth_token !== undefined ||
    bodyData.twilio_phone_no !== undefined
  ) {
    const safeSid = String(bodyData.twilio_sid || "").trim().replace(/'/g, "\\'");
    const safeToken = String(bodyData.twilio_auth_token || "").trim().replace(/'/g, "\\'");
    const safePhone = String(bodyData.twilio_phone_no || "").trim().replace(/'/g, "\\'");
    const safeTwilioStatus = (bodyData.twilio_status === "0" || bodyData.twilio_status === 0 || bodyData.twilio_status === false) ? 0 : 1;

    if (cleanStoreId > 0) {
      await DataUpdate(
        "tbl_store",
        `twilio_sid='${safeSid}', twilio_auth_token='${safeToken}', twilio_phone_no='${safePhone}', twilio_status=${safeTwilioStatus}`,
        `id=${cleanStoreId}`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    } else {
      await DataUpdate(
        "tbl_master_shop",
        `twilio_sid='${safeSid}', twilio_auth_token='${safeToken}', twilio_phone_no='${safePhone}', twilio_status=${safeTwilioStatus}`,
        `id=1`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    }
  }

  return true;
}

/**
 * Remove store-specific override so the branch inherits Global Defaults
 */
async function resetStoreNotificationSettings(storeId) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;
  if (cleanStoreId <= 0) return false;
  const promiseConn = conn.promise();
  await promiseConn.query(`DELETE FROM tbl_notification_settings WHERE store_id = ?`, [cleanStoreId]);
  return true;
}

function formatCustomerDisplayName(cust) {
  if (!cust) return "Valued Customer";
  const lName = (cust.last_name || "").trim();
  const fName = (cust.first_name || "").trim();
  if (fName && lName) return `${fName} ${lName}`;
  return (cust.name || fName || lName || "Valued Customer").trim();
}

function formatDateTimeReadable(val, dateOnly = false) {
  if (!val) return "TBD";
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);
  const datePart = d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
  if (dateOnly) return datePart;
  const timePart = d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  });
  return `${datePart} at ${timePart}`;
}

function isRouteDeliveryOrderType(orderType) {
  if (!orderType) return false;
  const t = String(orderType).trim();
  return (
    t === "Counter & Route" ||
    t === "Route & Route" ||
    t === "C & R" ||
    t === "R & R" ||
    t === "Counter & Delivery" ||
    t === "Pick-up & Delivery" ||
    t === "Customer drop-off & Store delivery" ||
    t === "Store collection & Store delivery"
  );
}

function isRoutePickupOrderType(orderType) {
  if (!orderType) return false;
  const t = String(orderType).trim();
  return (
    t === "Route & Route" ||
    t === "Route & Counter" ||
    t === "R & R" ||
    t === "R & C" ||
    t === "Pick-up & Delivery" ||
    t === "Pick-up & Counter" ||
    t === "Store collection & Store delivery"
  );
}

/**
 * Resolve SMTP configuration for a store (falling back to master store / any active tbl_email)
 */
async function resolveSmtpConfig(storeId) {
  if (storeId && storeId != "0") {
    const storeMail = await DataFind(`SELECT * FROM tbl_email WHERE store_id = '${storeId}' AND host IS NOT NULL AND host != '' LIMIT 1`);
    if (storeMail && storeMail.length > 0) return storeMail[0];
  }
  const fallbackMail = await DataFind(`SELECT * FROM tbl_email WHERE host IS NOT NULL AND host != '' ORDER BY id ASC LIMIT 1`);
  return fallbackMail && fallbackMail.length > 0 ? fallbackMail[0] : null;
}

/**
 * Resolve Twilio credentials for a store (falling back to tbl_master_shop)
 * Accepts either (storeId) OR (storeObj, masterObj)
 */
async function resolveTwilioConfig(storeOrId, masterObj) {
  let storeObj = null;
  let effectiveMaster = masterObj || null;

  if (typeof storeOrId === "object" && storeOrId !== null) {
    storeObj = storeOrId;
  } else if (storeOrId && Number(storeOrId) > 0) {
    const sRows = await DataFind(`SELECT * FROM tbl_store WHERE id = '${parseInt(storeOrId, 10)}' LIMIT 1`);
    if (sRows && sRows.length > 0) storeObj = sRows[0];
  }

  if (!effectiveMaster) {
    const mRows = await DataFind(`SELECT * FROM tbl_master_shop WHERE id = 1 LIMIT 1`);
    if (mRows && mRows.length > 0) effectiveMaster = mRows[0];
  }

  const sid = (storeObj && storeObj.twilio_sid && String(storeObj.twilio_sid).trim() !== "")
    ? String(storeObj.twilio_sid).trim()
    : (effectiveMaster && effectiveMaster.twilio_sid ? String(effectiveMaster.twilio_sid).trim() : "");
  const token = (storeObj && storeObj.twilio_auth_token && String(storeObj.twilio_auth_token).trim() !== "")
    ? String(storeObj.twilio_auth_token).trim()
    : (effectiveMaster && effectiveMaster.twilio_auth_token ? String(effectiveMaster.twilio_auth_token).trim() : "");
  const fromPhone = (storeObj && storeObj.twilio_phone_no && String(storeObj.twilio_phone_no).trim() !== "")
    ? String(storeObj.twilio_phone_no).trim()
    : (effectiveMaster && effectiveMaster.twilio_phone_no ? String(effectiveMaster.twilio_phone_no).trim() : "");
  const status = (storeObj && storeObj.twilio_status !== undefined && storeObj.twilio_status !== null)
    ? String(storeObj.twilio_status)
    : (effectiveMaster && effectiveMaster.twilio_status !== undefined && effectiveMaster.twilio_status !== null ? String(effectiveMaster.twilio_status) : "1");

  return {
    sid,
    token,
    fromPhone,
    phone: fromPhone,
    status,
    isConfigured: Boolean(sid && token && fromPhone && status !== "0")
  };
}

/**
 * Build Subject, HTML Email, and SMS text for any of the 12 events
 */
function buildNotificationContent({ eventKey, customer, store, master, order, items, extraData }) {
  const sym = (master && master.currency_symbol) ? master.currency_symbol : "$";
  const storeName = (store && store.name) ? store.name : ((master && master.app_name) ? master.app_name : "iCleaners");
  const storePhone = (store && store.mobile_number) ? store.mobile_number : "";
  const storeEmail = (store && store.store_email) ? store.store_email : "";
  const storeAddress = [store?.address, store?.city, store?.state, store?.zipcode].filter(Boolean).join(", ");
  const custName = formatCustomerDisplayName(customer);

  const orderCode = order ? (order.order_id || order.id) : (extraData?.orderCode || "");
  const orderType = order ? (order.order_type || "Counter & Counter") : "Counter & Counter";
  const grossTotal = order ? `${sym}${parseFloat(order.gross_total || 0).toFixed(2)}` : `${sym}0.00`;
  const paidAmount = order ? `${sym}${parseFloat(order.paid_amount || 0).toFixed(2)}` : `${sym}0.00`;
  const balanceDue = order ? `${sym}${parseFloat(order.balance_amount || 0).toFixed(2)}` : `${sym}0.00`;
  const readyDateStr = order ? formatDateTimeReadable(order.ready_date || order.delivery_date) : "TBD";
  const deliveryDateStr = order ? formatDateTimeReadable(order.delivery_date || order.ready_date) : "TBD";
  const pickupDateStr = order ? formatDateTimeReadable(order.pickup_date || order.order_date) : "TBD";

  let totalPieces = 0;
  if (Array.isArray(items) && items.length > 0) {
    items.forEach((it) => {
      const qty = parseFloat(it.service_quntity || 1) || 1;
      const pcs = parseInt(it.no_of_items || 1, 10) || 1;
      totalPieces += qty * pcs;
    });
  }

  let subject = `${storeName} Notification`;
  let headline = "Update from " + storeName;
  let badgeText = "Notification";
  let badgeColor = "#2563eb";
  let introHtml = "";
  let smsBody = "";

  switch (eventKey) {
    case "order_placed":
      subject = `Order Confirmation #${orderCode} - ${storeName}`;
      headline = `Thank You for Your Order!`;
      badgeText = `Order #${orderCode} Confirmed`;
      badgeColor = "#2563eb";
      introHtml = `<p>Hi <strong>${custName}</strong>, we have received your garments at <strong>${storeName}</strong>. Below is your order summary and target completion schedule.</p>`;
      smsBody = `Hi ${custName}, thank you for your order #${orderCode} at ${storeName} (${totalPieces} pcs)! Total: ${grossTotal} (Balance: ${balanceDue}). Ready by: ${readyDateStr}.`;
      break;

    case "route_pickup_scheduled":
      subject = `Route Pick-up Scheduled (#${orderCode}) - ${storeName}`;
      headline = `Your Garment Pick-up is Scheduled`;
      badgeText = `Route Pick-up #${orderCode}`;
      badgeColor = "#0284c7";
      introHtml = `<p>Hi <strong>${custName}</strong>, your route garment pick-up with <strong>${storeName}</strong> has been scheduled for <strong>${pickupDateStr}</strong>. Once our driver brings your garments to the store, we will inspect, itemize, and send you your updated order total.</p>`;
      smsBody = `Hi ${custName}, your garment pick-up (#${orderCode}) with ${storeName} is scheduled for ${pickupDateStr}. Call ${storePhone || "us"} for any special instructions.`;
      break;

    case "route_intake_priced":
      subject = `Your Garments Have Been Itemized (#${orderCode}) - ${storeName}`;
      headline = `Route Pick-up Inspected & Priced`;
      badgeText = `Order #${orderCode} Itemized`;
      badgeColor = "#0d9488";
      introHtml = `<p>Hi <strong>${custName}</strong>, we have received and inspected the garments collected during your route pick-up (<strong>${totalPieces} piece(s)</strong>). Here is your itemized order breakdown and completion schedule.</p>`;
      smsBody = `Hi ${custName}, we have inspected & itemized your garments for Order #${orderCode} (${totalPieces} pcs) at ${storeName}. Total: ${grossTotal} (Balance: ${balanceDue}). Ready/Delivery: ${readyDateStr}.`;
      break;

    case "order_modified":
      subject = `Order Updated (#${orderCode}) - ${storeName}`;
      headline = `Your Order Details Have Been Updated`;
      badgeText = `Order #${orderCode} Updated`;
      badgeColor = "#4f46e5";
      introHtml = `<p>Hi <strong>${custName}</strong>, your order <strong>#${orderCode}</strong> at <strong>${storeName}</strong> has been updated. Please review the revised summary below.</p>`;
      smsBody = `Hi ${custName}, your Order #${orderCode} at ${storeName} has been updated. Revised Total: ${grossTotal} (Balance Due: ${balanceDue}).`;
      break;

    case "order_processing":
      subject = `Your Order #${orderCode} is In Process - ${storeName}`;
      headline = `Garments In Cleaning Process`;
      badgeText = `In Process`;
      badgeColor = "#d97706";
      introHtml = `<p>Hi <strong>${custName}</strong>, your garments for Order <strong>#${orderCode}</strong> are currently being cleaned and cared for by our specialists at <strong>${storeName}</strong>.</p>`;
      smsBody = `Hi ${custName}, your Order #${orderCode} is now in cleaning process at ${storeName}. Estimated ready date: ${readyDateStr}.`;
      break;

    case "schedule_rescheduled":
      subject = `Updated Schedule for Order #${orderCode} - ${storeName}`;
      headline = `Order Schedule Updated`;
      badgeText = `Rescheduled`;
      badgeColor = "#ea580c";
      introHtml = `<p>Hi <strong>${custName}</strong>, the completion/delivery schedule for your Order <strong>#${orderCode}</strong> at <strong>${storeName}</strong> has been updated to <strong>${readyDateStr}</strong>.</p>`;
      smsBody = `Hi ${custName}, the schedule for your Order #${orderCode} at ${storeName} has been updated. New Ready/Delivery schedule: ${readyDateStr}.`;
      break;

    case "order_ready_pickup":
      subject = `Your Order #${orderCode} is Ready for Pickup! - ${storeName}`;
      headline = `Your Garments Are Clean & Ready!`;
      badgeText = `Ready for Counter Pickup`;
      badgeColor = "#16a34a";
      introHtml = `<p>Good news, <strong>${custName}</strong>! Your Order <strong>#${orderCode}</strong> (<strong>${totalPieces} piece(s)</strong>) is clean, pressed, and ready for pickup at <strong>${storeName}</strong>.</p>`;
      smsBody = `Good news ${custName}! Your Order #${orderCode} (${totalPieces} pcs) at ${storeName} is clean and READY for pickup. Balance Due: ${balanceDue}.`;
      break;

    case "order_out_for_delivery":
      subject = `Your Order #${orderCode} is Ready for Route Delivery - ${storeName}`;
      headline = `Scheduled for Route Delivery`;
      badgeText = `Out for Delivery`;
      badgeColor = "#059669";
      introHtml = `<p>Hi <strong>${custName}</strong>, your clean garments for Order <strong>#${orderCode}</strong> (<strong>${totalPieces} piece(s)</strong>) are ready and scheduled for route delivery on <strong>${deliveryDateStr}</strong>.</p>`;
      smsBody = `Hi ${custName}, your clean garments for Order #${orderCode} (${totalPieces} pcs) from ${storeName} are ready for delivery on ${deliveryDateStr}. Balance Due: ${balanceDue}.`;
      break;

    case "order_delivered":
      subject = `Order #${orderCode} Completed & Delivered - ${storeName}`;
      headline = `Order Completed — Thank You!`;
      badgeText = `Delivered / Completed`;
      badgeColor = "#15803d";
      introHtml = `<p>Thank you, <strong>${custName}</strong>! Your Order <strong>#${orderCode}</strong> has been marked as completed and delivered. We truly appreciate your trust in <strong>${storeName}</strong>.</p>`;
      smsBody = `Thank you ${custName}! Your Order #${orderCode} from ${storeName} has been completed and delivered. We appreciate your business!`;
      break;

    case "payment_received": {
      const paidNowNum = parseFloat(extraData?.paidNow || 0);
      const paidNowFormatted = `${sym}${paidNowNum.toFixed(2)}`;
      const methodStr = extraData?.paymentMethod ? ` via ${extraData.paymentMethod}` : "";
      const refStr = extraData?.referenceNumber ? ` (Ref: ${extraData.referenceNumber})` : "";
      subject = `Payment Receipt for Order #${orderCode} - ${storeName}`;
      headline = `Payment Received — Thank You!`;
      badgeText = `Payment Confirmed: ${paidNowFormatted}`;
      badgeColor = "#16a34a";
      introHtml = `<p>Hi <strong>${custName}</strong>, we have received your payment of <strong>${paidNowFormatted}</strong>${methodStr}${refStr} for Order <strong>#${orderCode}</strong> at <strong>${storeName}</strong>.</p>`;
      smsBody = `Payment confirmed! We received ${paidNowFormatted}${methodStr} for Order #${orderCode} at ${storeName}. Remaining Balance: ${balanceDue}. Thank you!`;
      break;
    }

    case "order_cancelled": {
      const reason = extraData?.cancelReason || (order && order.note) || "Cancelled by store";
      subject = `Order #${orderCode} Cancelled - ${storeName}`;
      headline = `Order Cancellation Notice`;
      badgeText = `Cancelled / Voided`;
      badgeColor = "#dc2626";
      introHtml = `<p>Hi <strong>${custName}</strong>, your Order <strong>#${orderCode}</strong> at <strong>${storeName}</strong> has been cancelled/voided.<br><strong>Reason:</strong> ${reason}</p>`;
      smsBody = `Hi ${custName}, your Order #${orderCode} at ${storeName} has been cancelled (${reason}). Please call ${storePhone || "us"} if you have any questions.`;
      break;
    }

    case "welcome_customer":
      subject = `Welcome to ${storeName}, ${custName}!`;
      headline = `Welcome to ${storeName}!`;
      badgeText = `New Customer Profile`;
      badgeColor = "#2563eb";
      introHtml = `<p>Hi <strong>${custName}</strong>, welcome to <strong>${storeName}</strong>! Your customer profile has been registered. Whether you prefer counter drop-off or route pick-up & delivery, we look forward to caring for your garments.</p>`;
      smsBody = `Welcome to ${storeName}, ${custName}! Your customer profile is active. Call us at ${storePhone || "our store"} anytime for dry cleaning & laundry service.`;
      break;

    default:
      introHtml = `<p>Hi <strong>${custName}</strong>, here is an update from <strong>${storeName}</strong>.</p>`;
      smsBody = `Hi ${custName}, update from ${storeName} regarding Order #${orderCode}.`;
      break;
  }

  // Build itemized table HTML if order is present
  let orderDetailsHtml = "";
  if (order) {
    let itemsRowsHtml = "";
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((it) => {
        const sName = it.service_name || "Service";
        const sType = it.service_type_name ? ` <span style="color:#64748b;font-size:12px;">[${it.service_type_name}]</span>` : "";
        const colorPat = [it.primary_color, it.secondary_color].filter(Boolean).join("/");
        const patBadge = (it.garment_pattern && it.garment_pattern !== "Solid") ? ` (${it.garment_pattern})` : "";
        const metaStr = (colorPat || patBadge) ? `<div style="font-size:11px;color:#64748b;">${colorPat}${patBadge}</div>` : "";
        const qty = it.service_quntity || 1;
        const price = `${sym}${parseFloat(it.service_type_price || 0).toFixed(2)}`;
        itemsRowsHtml += `
          <tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><strong>${sName}</strong>${sType}${metaStr}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${qty}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${price}</td>
          </tr>
        `;
      });
    } else {
      itemsRowsHtml = `
        <tr>
          <td colspan="3" style="padding:12px;text-align:center;color:#64748b;font-style:italic;">
            Garments pending store intake inspection & itemization
          </td>
        </tr>
      `;
    }

    orderDetailsHtml = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:18px 0;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
          <div><span style="color:#64748b;font-size:12px;">ORDER NUMBER</span><div style="font-weight:700;font-size:15px;color:#0f172a;">#${orderCode}</div></div>
          <div><span style="color:#64748b;font-size:12px;">SERVICE TYPE</span><div style="font-weight:600;font-size:13px;color:#0f172a;">${orderType}</div></div>
          <div><span style="color:#64748b;font-size:12px;">READY / DELIVERY SCHEDULE</span><div style="font-weight:700;font-size:13px;color:#2563eb;">${readyDateStr}</div></div>
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#eff6ff;color:#1e3a8a;text-align:left;">
              <th style="padding:8px 10px;border-bottom:1px solid #bfdbfe;">Garment / Service</th>
              <th style="padding:8px 10px;border-bottom:1px solid #bfdbfe;text-align:center;">Qty</th>
              <th style="padding:8px 10px;border-bottom:1px solid #bfdbfe;text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRowsHtml}
          </tbody>
        </table>
        <div style="margin-top:14px;padding-top:10px;border-top:1px solid #cbd5e1;text-align:right;font-size:13px;">
          <div style="margin-bottom:4px;">Gross Total: <strong>${grossTotal}</strong></div>
          <div style="margin-bottom:4px;color:#16a34a;">Amount Paid: <strong>${paidAmount}</strong></div>
          <div style="font-size:15px;color:#dc2626;">Balance Due: <strong>${balanceDue}</strong></div>
        </div>
      </div>
    `;
  }

  const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;color:#1e293b;">
      <div style="background:${badgeColor};color:#ffffff;padding:20px 24px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;opacity:0.9;margin-bottom:4px;">${badgeText}</div>
        <h2 style="margin:0;font-size:20px;font-weight:700;">${headline}</h2>
      </div>
      <div style="padding:24px;">
        ${introHtml}
        ${orderDetailsHtml}
        <div style="margin-top:20px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
          <strong style="color:#0f172a;">${storeName}</strong><br>
          ${storeAddress ? `${storeAddress}<br>` : ""}
          ${storePhone ? `Phone: ${storePhone} ` : ""}${storeEmail ? `| Email: ${storeEmail}` : ""}
        </div>
      </div>
    </div>
  `;

  return { subject, htmlBody, smsBody };
}

/**
 * Main Dispatcher: Checks Notification Settings and sends Email, SMS, and Push
 */
async function dispatchCustomerNotification({
  eventKey,
  storeId,
  customerId,
  orderId = null,
  extraData = {},
  accessdata = null
}) {
  try {
    let orderObj = null;
    let itemsList = [];

    if (orderId) {
      const cleanOrderId = String(orderId).trim().replace(/'/g, "\\'");
      const ordRows = await DataFind(
        `SELECT * FROM tbl_order WHERE id = '${cleanOrderId}' OR order_id = '${cleanOrderId}' LIMIT 1`
      );
      if (ordRows && ordRows.length > 0) {
        orderObj = ordRows[0];
        if (!storeId) storeId = orderObj.store_id;
        if (!customerId) customerId = orderObj.customer_id;

        if (orderObj.service_list && String(orderObj.service_list).trim() !== "0" && String(orderObj.service_list).trim() !== "") {
          itemsList = await DataFind(
            `SELECT * FROM tbl_cart_servicelist WHERE FIND_IN_SET(id, '${orderObj.service_list}')`
          );
        }
      }
    }

    const effectiveStoreId = parseInt(storeId, 10) || 0;
    const settings = await getEffectiveNotificationSettings(effectiveStoreId);
    const eventCfg = settings.events[eventKey] || { email: false, sms: false };

    const shouldSendEmail = Boolean(settings.email_enabled && eventCfg.email);
    const shouldSendSms = Boolean(settings.sms_enabled && eventCfg.sms);
    const shouldSendPush = Boolean(settings.push_enabled);

    if (!shouldSendEmail && !shouldSendSms && !shouldSendPush) {
      return { sentEmail: false, sentSms: false, sentPush: false, skipped: true };
    }

    let customerObj = null;
    if (customerId && String(customerId) !== "0") {
      const cleanCustId = String(customerId).trim().replace(/'/g, "\\'");
      const custRows = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${cleanCustId}' LIMIT 1`);
      if (custRows && custRows.length > 0) {
        customerObj = custRows[0];
      }
    }

    const storeRows = effectiveStoreId > 0
      ? await DataFind(`SELECT * FROM tbl_store WHERE id = '${effectiveStoreId}' LIMIT 1`)
      : [];
    const storeObj = storeRows && storeRows.length > 0 ? storeRows[0] : {};

    const masterRows = await DataFind(`SELECT * FROM tbl_master_shop LIMIT 1`);
    const masterObj = masterRows && masterRows.length > 0 ? masterRows[0] : (accessdata?.masterstore || {});

    const isWalkIn = !customerObj ||
      (customerObj.name && customerObj.name.toLowerCase().includes("walk in")) ||
      (customerObj.name && customerObj.name.toLowerCase().includes("walkin"));

    const { subject, htmlBody, smsBody } = buildNotificationContent({
      eventKey,
      customer: customerObj,
      store: storeObj,
      master: masterObj,
      order: orderObj,
      items: itemsList,
      extraData
    });

    let sentEmail = false;
    let sentSms = false;
    let sentPush = false;

    // 1. Send Email if enabled and customer has email
    if (shouldSendEmail && !isWalkIn && customerObj && customerObj.email && String(customerObj.email).trim() !== "") {
      const smtp = await resolveSmtpConfig(effectiveStoreId);
      if (smtp && smtp.host && smtp.port && smtp.username && smtp.password && smtp.frommail) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: Number(smtp.port),
            auth: {
              user: smtp.username,
              pass: smtp.password
            }
          });
          transporter.sendMail(
            {
              from: smtp.frommail,
              to: String(customerObj.email).trim(),
              subject: subject,
              html: htmlBody
            },
            (err) => {
              if (err) console.error(`[NotificationService] Email error (${eventKey}):`, err.message);
            }
          );
          sentEmail = true;
        } catch (emailErr) {
          console.error(`[NotificationService] Transporter error (${eventKey}):`, emailErr.message);
        }
      }
    }

    // 2. Send SMS if enabled and customer has phone number
    if (shouldSendSms && !isWalkIn && customerObj && customerObj.number && String(customerObj.number).trim() !== "") {
      const twilioCfg = await resolveTwilioConfig(storeObj, masterObj);
      if (twilioCfg.isConfigured) {
        try {
          const clientSms = require("twilio")(twilioCfg.sid, twilioCfg.token);
          clientSms.messages
            .create({
              body: smsBody,
              from: twilioCfg.fromPhone,
              to: String(customerObj.number).trim()
            })
            .catch((smsErr) => {
              console.error(`[NotificationService] SMS error (${eventKey}):`, smsErr.message);
            });
          sentSms = true;
        } catch (twilioErr) {
          console.error(`[NotificationService] Twilio init error (${eventKey}):`, twilioErr.message);
        }
      }
    }

    // 3. Send Push Notification via OneSignal if enabled
    if (shouldSendPush) {
      const onesignalAppId = (storeObj && storeObj.onesignal_app_id)
        ? storeObj.onesignal_app_id
        : (masterObj && masterObj.onesignal_app_id ? masterObj.onesignal_app_id : "");
      if (onesignalAppId) {
        try {
          const pushMsg = {
            app_id: onesignalAppId,
            contents: { en: smsBody },
            headings: { en: storeObj.name || masterObj.app_name || "iCleaners" },
            included_segments: ["Subscribed Users"],
            filters: [
              { field: "tag", key: "subscription_user_Type", relation: "=", value: "master" },
              { operator: "AND" },
              { field: "tag", key: "Login_ID", relation: "=", value: "1" }
            ]
          };
          sendNotification(pushMsg);
          sentPush = true;
        } catch (pushErr) {
          console.error(`[NotificationService] Push error (${eventKey}):`, pushErr.message);
        }
      }
    }

    return { sentEmail, sentSms, sentPush };
  } catch (err) {
    console.error(`[NotificationService] Error dispatching ${eventKey}:`, err);
    return { sentEmail: false, sentSms: false, sentPush: false, error: err.message };
  }
}

/**
 * Live Test Notification Sender (from Notification Settings UI)
 */
async function sendTestNotification({ storeId = 0, channel = "email", recipient = "" }) {
  const cleanRecipient = String(recipient || "").trim();
  if (!cleanRecipient) {
    return { success: false, message: "Please enter a valid recipient email or phone number." };
  }

  const effectiveStoreId = parseInt(storeId, 10) || 0;
  const storeRows = effectiveStoreId > 0
    ? await DataFind(`SELECT * FROM tbl_store WHERE id = '${effectiveStoreId}' LIMIT 1`)
    : [];
  const storeObj = storeRows && storeRows.length > 0 ? storeRows[0] : {};
  const masterRows = await DataFind(`SELECT * FROM tbl_master_shop LIMIT 1`);
  const masterObj = masterRows && masterRows.length > 0 ? masterRows[0] : {};
  const storeName = storeObj.name || masterObj.app_name || "iCleaners";

  if (channel === "email") {
    const smtp = await resolveSmtpConfig(effectiveStoreId);
    if (!smtp || !smtp.host || !smtp.username || !smtp.password || !smtp.frommail) {
      return {
        success: false,
        message: "SMTP mail server is not configured yet. Please configure Mail Settings first."
      };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: Number(smtp.port) || 587,
        auth: {
          user: smtp.username,
          pass: smtp.password
        }
      });

      await transporter.sendMail({
        from: smtp.frommail,
        to: cleanRecipient,
        subject: `[Test] ${storeName} Notification System Verification`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;background:#ffffff;">
            <div style="background:#2563eb;color:#ffffff;padding:18px 24px;">
              <h3 style="margin:0;">${storeName} — Test Email Successful!</h3>
            </div>
            <div style="padding:24px;color:#1e293b;font-size:14px;line-height:1.6;">
              <p>Your outgoing SMTP notification channel is active and properly configured.</p>
              <p style="margin-bottom:0;color:#64748b;font-size:12px;">Sent at: ${new Date().toLocaleString()}</p>
            </div>
          </div>
        `
      });

      return { success: true, message: `Test email sent successfully to ${cleanRecipient}!` };
    } catch (err) {
      return { success: false, message: `SMTP Error: ${err.message}` };
    }
  } else if (channel === "sms") {
    const twilioCfg = await resolveTwilioConfig(storeObj, masterObj);
    if (!twilioCfg.isConfigured) {
      return {
        success: false,
        message: "Twilio SMS credentials (SID, Auth Token, Phone Number) are not configured in Store / Master Settings."
      };
    }

    try {
      const clientSms = require("twilio")(twilioCfg.sid, twilioCfg.token);
      await clientSms.messages.create({
        body: `[${storeName}] Test SMS successful! Your automated customer SMS notifications are active.`,
        from: twilioCfg.fromPhone,
        to: cleanRecipient
      });
      return { success: true, message: `Test SMS dispatched successfully to ${cleanRecipient}!` };
    } catch (err) {
      return { success: false, message: `Twilio SMS Error: ${err.message}` };
    }
  }

  return { success: false, message: "Unsupported test channel." };
}

module.exports = {
  NOTIFICATION_EVENTS,
  getEffectiveNotificationSettings,
  saveNotificationSettings,
  saveEmailAndTwilioGateways,
  resetStoreNotificationSettings,
  dispatchCustomerNotification,
  sendTestNotification,
  resolveSmtpConfig,
  resolveTwilioConfig,
  isRouteDeliveryOrderType,
  isRoutePickupOrderType
};

