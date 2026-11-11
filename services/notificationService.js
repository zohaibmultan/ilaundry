/**
 * Centralized Customer Notification Service (Email, SMS & Push)
 * Supports two-tier configuration (Global defaults + Per-store overrides)
 * and dispatches notifications across all customer lifecycle events.
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
        templates_config LONGTEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_notif_store_id (store_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const [cols] = await promiseConn.query("SHOW COLUMNS FROM tbl_notification_settings");
    if (!cols.some((c) => c.Field === "templates_config")) {
      await promiseConn.query(
        "ALTER TABLE tbl_notification_settings ADD COLUMN templates_config LONGTEXT NULL AFTER events_config"
      );
    }
    tableVerified = true;
  } catch (e) {
    console.error("Warning: ensureSettingsTable failed:", e.message);
  }
}

/**
 * Supported Dynamic Template Variables (Merge Tags)
 */
const TEMPLATE_VARIABLES = [
  { tag: "{customer_name}", label: "Customer Name", sample: "John Smith" },
  { tag: "{order_id}", label: "Order Number", sample: "ORD-1024" },
  { tag: "{store_name}", label: "Store Name", sample: "FOUR SEASONS ICLEANERS" },
  { tag: "{store_phone}", label: "Store Phone", sample: "(718) 555-0199" },
  { tag: "{store_email}", label: "Store Email", sample: "info@icleaners.com" },
  { tag: "{store_address}", label: "Store Address", sample: "123 Main St, NY" },
  { tag: "{gross_total}", label: "Order Gross Total", sample: "$48.50" },
  { tag: "{paid_amount}", label: "Total Paid Amount", sample: "$20.00" },
  { tag: "{balance_due}", label: "Remaining Balance", sample: "$28.50" },
  { tag: "{total_pieces}", label: "Total Garment Pieces", sample: "4" },
  { tag: "{ready_date}", label: "Target Ready Date/Time", sample: "Nov 5, 2026 at 4:00 PM" },
  { tag: "{delivery_date}", label: "Route Delivery Date/Time", sample: "Nov 5, 2026 at 5:00 PM" },
  { tag: "{pickup_date}", label: "Route Pick-up Date/Time", sample: "Nov 3, 2026 at 10:00 AM" },
  { tag: "{rack_names}", label: "Assigned Rack(s)", sample: "Rack A1, Rack B2" },
  { tag: "{paid_now}", label: "Payment Just Received", sample: "$20.00" },
  { tag: "{payment_method}", label: "Payment Method", sample: "Cash" },
  { tag: "{cancel_reason}", label: "Cancellation Reason", sample: "Customer request" },
];

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
    defaultEmailSubject: "Order Confirmation #{order_id} - {store_name}",
    defaultEmailHeadline: "Thank You for Your Order!",
    defaultEmailBody: "Hi {customer_name}, we have received your garments at {store_name}. Below is your order summary and target completion schedule.",
    defaultSmsBody: "Hi {customer_name}, thank you for your order #{order_id} at {store_name} ({total_pieces} pcs)! Total: {gross_total} (Balance: {balance_due}). Ready by: {ready_date}.",
    sampleSms: "Hi {customer_name}, thank you for your order #{order_id} at {store_name} ({total_pieces} pcs)! Total: {gross_total} (Balance: {balance_due}). Ready by: {ready_date}."
  },
  {
    key: "route_pickup_scheduled",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Route Pick-up Scheduled (R • R / R • C)",
    triggerBadge: "Route Order Intake",
    description: "Sent when a Route Pick-up order (including 0-item pending intake) is scheduled, confirming the pickup date and 1-hour driver time slot.",
    defaultEmail: true,
    defaultSms: true,
    defaultEmailSubject: "Route Pick-up Scheduled (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Garment Pick-up is Scheduled",
    defaultEmailBody: "Hi {customer_name}, your route garment pick-up with {store_name} has been scheduled for {pickup_date}. Once our driver brings your garments to the store, we will inspect, itemize, and send you your updated order total.",
    defaultSmsBody: "Hi {customer_name}, your garment pick-up (#{order_id}) with {store_name} is scheduled for {pickup_date}. Call {store_phone} for any special instructions.",
    sampleSms: "Hi {customer_name}, your garment pick-up (#{order_id}) with {store_name} is scheduled for {pickup_date}. Call {store_phone} for any special instructions."
  },
  {
    key: "pickup_request_accepted",
    category: "intake",
    categoryTitle: "1. Order Intake & Placement",
    categoryIcon: "fa-shopping-basket",
    title: "Customer Pick-up Request Accepted",
    triggerBadge: "Pickup Request Approved",
    description: "Sent immediately when Admin or Staff accepts a customer's submitted pick-up request and converts it into an active order.",
    defaultEmail: true,
    defaultSms: true,
    defaultEmailSubject: "Pick-up Request Accepted (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Pick-up Request Has Been Accepted!",
    defaultEmailBody: "Hi {customer_name}, great news! Your clothes pick-up request #{order_id} with {store_name} has been accepted and scheduled for {pickup_date}. Our driver will collect your garments at the scheduled time.",
    defaultSmsBody: "Hi {customer_name}, your pick-up request #{order_id} at {store_name} has been ACCEPTED! Confirmed pick-up: {pickup_date}. Call {store_phone} for any questions.",
    sampleSms: "Hi {customer_name}, your pick-up request #{order_id} at {store_name} has been ACCEPTED! Confirmed pick-up: {pickup_date}. Call {store_phone} for any questions."
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
    defaultEmailSubject: "Your Garments Have Been Itemized (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Route Pick-up Inspected & Priced",
    defaultEmailBody: "Hi {customer_name}, we have received and inspected the garments collected during your route pick-up ({total_pieces} piece(s)). Here is your itemized order breakdown and completion schedule.",
    defaultSmsBody: "Hi {customer_name}, we have inspected & itemized your garments for Order #{order_id} ({total_pieces} pcs) at {store_name}. Total: {gross_total} (Balance: {balance_due}). Ready/Delivery: {ready_date}.",
    sampleSms: "Hi {customer_name}, we have inspected & itemized your garments for Order #{order_id} ({total_pieces} pcs) at {store_name}. Total: {gross_total} (Balance: {balance_due}). Ready/Delivery: {ready_date}."
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
    defaultEmailSubject: "Order Updated (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Order Details Have Been Updated",
    defaultEmailBody: "Hi {customer_name}, your order #{order_id} at {store_name} has been updated. Please review the revised summary below.",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been updated. Revised Total: {gross_total} (Balance Due: {balance_due}).",
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
    defaultEmailSubject: "Your Order #{order_id} is In Process - {store_name}",
    defaultEmailHeadline: "Garments In Cleaning Process",
    defaultEmailBody: "Hi {customer_name}, your garments for Order #{order_id} are currently being cleaned and cared for by our specialists at {store_name}.",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} is now in cleaning process at {store_name}. Estimated ready date: {ready_date}.",
    sampleSms: "Hi {customer_name}, your Order #{order_id} is now in cleaning process at {store_name}. Estimated ready date: {ready_date}."
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
    defaultEmailSubject: "Updated Schedule for Order #{order_id} - {store_name}",
    defaultEmailHeadline: "Order Schedule Updated",
    defaultEmailBody: "Hi {customer_name}, the completion/delivery schedule for your Order #{order_id} at {store_name} has been updated to {ready_date}.",
    defaultSmsBody: "Hi {customer_name}, the schedule for your Order #{order_id} at {store_name} has been updated. New Ready/Delivery schedule: {ready_date}.",
    sampleSms: "Hi {customer_name}, the schedule for your Order #{order_id} at {store_name} has been updated. New Ready/Delivery schedule: {ready_date}."
  },

  // Category 3: Ready for Pickup & Route Delivery
  {
    key: "order_ready_pickup",
    category: "ready",
    categoryTitle: "3. Ready for Pickup & Route Delivery",
    categoryIcon: "fa-check-double",
    title: "Order Ready for Counter Pickup (C • C / R • C)",
    triggerBadge: "Status: Ready (Counter)",
    description: "Sent when a Counter Pickup order is marked Ready, including total garment pieces, store address/phone, and remaining balance due.",
    defaultEmail: true,
    defaultSms: true,
    defaultEmailSubject: "Your Order #{order_id} is Ready for Pickup! - {store_name}",
    defaultEmailHeadline: "Your Garments Are Clean & Ready!",
    defaultEmailBody: "Good news, {customer_name}! Your Order #{order_id} ({total_pieces} piece(s)) is clean, pressed, and ready for pickup at {store_name}.",
    defaultSmsBody: "Good news {customer_name}! Your Order #{order_id} ({total_pieces} pcs) at {store_name} is clean and READY for pickup. Balance Due: {balance_due}.",
    sampleSms: "Good news {customer_name}! Your Order #{order_id} ({total_pieces} pcs) at {store_name} is clean and READY for pickup. Balance Due: {balance_due}."
  },
  {
    key: "order_out_for_delivery",
    category: "ready",
    categoryTitle: "3. Ready for Pickup & Route Delivery",
    categoryIcon: "fa-check-double",
    title: "Out for Route Delivery (C • R / R • R)",
    triggerBadge: "Status: Ready / En Route",
    description: "Sent when a Route Delivery order is marked Ready or Out for Delivery, notifying the customer of the scheduled delivery window and balance due.",
    defaultEmail: true,
    defaultSms: true,
    defaultEmailSubject: "Your Order #{order_id} is Ready for Route Delivery - {store_name}",
    defaultEmailHeadline: "Scheduled for Route Delivery",
    defaultEmailBody: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} piece(s)) are ready and scheduled for route delivery on {delivery_date}.",
    defaultSmsBody: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} pcs) from {store_name} are ready for delivery on {delivery_date}. Balance Due: {balance_due}.",
    sampleSms: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} pcs) from {store_name} are ready for delivery on {delivery_date}. Balance Due: {balance_due}."
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
    defaultEmailSubject: "Order #{order_id} Completed & Delivered - {store_name}",
    defaultEmailHeadline: "Order Completed — Thank You!",
    defaultEmailBody: "Thank you, {customer_name}! Your Order #{order_id} has been marked as completed and delivered. We truly appreciate your trust in {store_name}.",
    defaultSmsBody: "Thank you {customer_name}! Your Order #{order_id} from {store_name} has been completed and delivered. We appreciate your business!",
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
    defaultEmailSubject: "Payment Receipt for Order #{order_id} - {store_name}",
    defaultEmailHeadline: "Payment Received — Thank You!",
    defaultEmailBody: "Hi {customer_name}, we have received your payment of {paid_now} for Order #{order_id} at {store_name}.",
    defaultSmsBody: "Payment confirmed! We received {paid_now} for Order #{order_id} at {store_name}. Remaining Balance: {balance_due}. Thank you!",
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
    defaultEmailSubject: "Order #{order_id} Cancelled - {store_name}",
    defaultEmailHeadline: "Order Cancellation Notice",
    defaultEmailBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled/voided. Reason: {cancel_reason}",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled ({cancel_reason}). Please call {store_phone} if you have any questions.",
    sampleSms: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled ({cancel_reason}). Please call {store_phone} if you have any questions."
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
    defaultEmailSubject: "Welcome to {store_name}, {customer_name}!",
    defaultEmailHeadline: "Welcome to {store_name}!",
    defaultEmailBody: "Hi {customer_name}, welcome to {store_name}! Your customer profile has been registered. Whether you prefer counter drop-off or route pick-up & delivery, we look forward to caring for your garments.",
    defaultSmsBody: "Welcome to {store_name}, {customer_name}! Your customer profile is active. Call us at {store_phone} anytime for dry cleaning & laundry service.",
    sampleSms: "Welcome to {store_name}, {customer_name}! Your customer profile is active. Call us at {store_phone} anytime for dry cleaning & laundry service."
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

function getDefaultTemplatesMap() {
  const map = {};
  NOTIFICATION_EVENTS.forEach((ev) => {
    map[ev.key] = {
      emailSubject: ev.defaultEmailSubject,
      emailHeadline: ev.defaultEmailHeadline,
      emailBody: ev.defaultEmailBody,
      smsBody: ev.defaultSmsBody
    };
  });
  return map;
}

function mergeTemplatesConfig(rawJson, fallbackMap) {
  const base = fallbackMap ? JSON.parse(JSON.stringify(fallbackMap)) : getDefaultTemplatesMap();
  if (!rawJson) return base;
  try {
    const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
    if (parsed && typeof parsed === "object") {
      NOTIFICATION_EVENTS.forEach((ev) => {
        const custom = parsed[ev.key];
        if (custom && typeof custom === "object") {
          if (typeof custom.emailSubject === "string" && custom.emailSubject.trim() !== "") {
            base[ev.key].emailSubject = custom.emailSubject.trim();
          }
          if (typeof custom.emailHeadline === "string" && custom.emailHeadline.trim() !== "") {
            base[ev.key].emailHeadline = custom.emailHeadline.trim();
          }
          if (typeof custom.emailBody === "string" && custom.emailBody.trim() !== "") {
            base[ev.key].emailBody = custom.emailBody.trim();
          }
          if (typeof custom.smsBody === "string" && custom.smsBody.trim() !== "") {
            base[ev.key].smsBody = custom.smsBody.trim();
          }
        }
      });
    }
  } catch (e) {
    // ignore malformed json
  }
  return base;
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
 * Resolve effective notification settings & templates for a store (with fallback to store_id = 0 global settings)
 */
async function getEffectiveNotificationSettings(storeId = 0) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;

  const builtInDefaults = getDefaultTemplatesMap();
  const globalRows = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = 0 LIMIT 1`);
  const globalRow = globalRows && globalRows.length > 0 ? globalRows[0] : null;
  const globalEvents = mergeEventsConfig(globalRow ? globalRow.events_config : null, getDefaultEventsMap());
  const globalTemplates = mergeTemplatesConfig(globalRow ? globalRow.templates_config : null, builtInDefaults);

  const computeCustomFlags = (resolvedTpls, compareTpls) => {
    const flags = {};
    NOTIFICATION_EVENTS.forEach((ev) => {
      const a = resolvedTpls[ev.key] || {};
      const b = compareTpls[ev.key] || {};
      flags[ev.key] = Boolean(
        a.emailSubject !== b.emailSubject ||
        a.emailHeadline !== b.emailHeadline ||
        a.emailBody !== b.emailBody ||
        a.smsBody !== b.smsBody
      );
    });
    return flags;
  };

  let globalSettings = {
    store_id: 0,
    is_custom_store_override: false,
    email_enabled: globalRow ? Number(globalRow.email_enabled) === 1 : true,
    sms_enabled: globalRow ? Number(globalRow.sms_enabled) === 1 : true,
    push_enabled: globalRow ? Number(globalRow.push_enabled) === 1 : true,
    events: globalEvents,
    templates: globalTemplates,
    defaultTemplates: builtInDefaults,
    customTemplateFlags: computeCustomFlags(globalTemplates, builtInDefaults)
  };

  if (cleanStoreId === 0) {
    return globalSettings;
  }

  const storeRows = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);
  if (!storeRows || storeRows.length === 0) {
    return {
      ...globalSettings,
      store_id: cleanStoreId,
      is_custom_store_override: false,
      customTemplateFlags: computeCustomFlags(globalTemplates, builtInDefaults)
    };
  }

  const sRow = storeRows[0];
  const storeTemplates = mergeTemplatesConfig(sRow.templates_config, globalTemplates);
  return {
    store_id: cleanStoreId,
    is_custom_store_override: true,
    email_enabled: Number(sRow.email_enabled) === 1,
    sms_enabled: Number(sRow.sms_enabled) === 1,
    push_enabled: Number(sRow.push_enabled) === 1,
    events: mergeEventsConfig(sRow.events_config, globalEvents),
    templates: storeTemplates,
    defaultTemplates: builtInDefaults,
    customTemplateFlags: computeCustomFlags(storeTemplates, builtInDefaults)
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
 * Save custom notification templates for storeId (0 = Global Master, >0 = Store Override)
 */
async function saveNotificationTemplates(storeId, bodyData, req) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;

  const existing = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);
  let currentTemplates = {};
  if (existing && existing.length > 0 && existing[0].templates_config) {
    try {
      const parsed = typeof existing[0].templates_config === "string"
        ? JSON.parse(existing[0].templates_config)
        : existing[0].templates_config;
      if (parsed && typeof parsed === "object") {
        currentTemplates = parsed;
      }
    } catch (e) {
      currentTemplates = {};
    }
  }

  NOTIFICATION_EVENTS.forEach((ev) => {
    const subjKey = `tpl_${ev.key}_emailSubject`;
    const headKey = `tpl_${ev.key}_emailHeadline`;
    const bodyKey = `tpl_${ev.key}_emailBody`;
    const smsKey = `tpl_${ev.key}_smsBody`;

    if (
      bodyData[subjKey] !== undefined ||
      bodyData[headKey] !== undefined ||
      bodyData[bodyKey] !== undefined ||
      bodyData[smsKey] !== undefined
    ) {
      const prev = currentTemplates[ev.key] || {};
      currentTemplates[ev.key] = {
        emailSubject: bodyData[subjKey] !== undefined ? String(bodyData[subjKey]).trim() : (prev.emailSubject || ev.defaultEmailSubject || ""),
        emailHeadline: bodyData[headKey] !== undefined ? String(bodyData[headKey]).trim() : (prev.emailHeadline || ev.defaultEmailHeadline || ""),
        emailBody: bodyData[bodyKey] !== undefined ? String(bodyData[bodyKey]).trim() : (prev.emailBody || ev.defaultEmailBody || ""),
        smsBody: bodyData[smsKey] !== undefined ? String(bodyData[smsKey]).trim() : (prev.smsBody || ev.defaultSmsBody || "")
      };
    }
  });

  const jsonStr = JSON.stringify(currentTemplates).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  if (existing && existing.length > 0) {
    await DataUpdate(
      "tbl_notification_settings",
      `templates_config = '${jsonStr}'`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  } else {
    const defaultEventsJson = JSON.stringify(getDefaultEventsMap()).replace(/'/g, "\\'");
    await DataInsert(
      "tbl_notification_settings",
      `store_id, email_enabled, sms_enabled, push_enabled, events_config, templates_config`,
      `${cleanStoreId}, 1, 1, 1, '${defaultEventsJson}', '${jsonStr}'`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  }
  return true;
}

/**
 * Reset custom notification templates to default for a single eventKey or all events
 */
async function resetNotificationTemplates(storeId, eventKey = null, req) {
  await ensureSettingsTable();
  const cleanStoreId = parseInt(storeId, 10) || 0;
  const existing = await DataFind(`SELECT * FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);
  if (!existing || existing.length === 0) return true;

  if (!eventKey || eventKey === "all") {
    await DataUpdate(
      "tbl_notification_settings",
      `templates_config = NULL`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
    return true;
  }

  let currentTemplates = {};
  if (existing[0].templates_config) {
    try {
      const parsed = typeof existing[0].templates_config === "string"
        ? JSON.parse(existing[0].templates_config)
        : existing[0].templates_config;
      if (parsed && typeof parsed === "object") {
        currentTemplates = parsed;
      }
    } catch (e) {
      currentTemplates = {};
    }
  }

  delete currentTemplates[eventKey];
  const keysRemaining = Object.keys(currentTemplates);
  if (keysRemaining.length === 0) {
    await DataUpdate(
      "tbl_notification_settings",
      `templates_config = NULL`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  } else {
    const jsonStr = JSON.stringify(currentTemplates).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    await DataUpdate(
      "tbl_notification_settings",
      `templates_config = '${jsonStr}'`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
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

/**
 * Replace {variable_name} placeholders in template strings
 */
function interpolateTemplate(templateStr, varsMap = {}) {
  if (!templateStr) return "";
  return String(templateStr).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(varsMap, key) && varsMap[key] !== undefined && varsMap[key] !== null) {
      return String(varsMap[key]);
    }
    return match;
  });
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
  try {
    const OrderTypes = require("../public/js/shared/orderTypes");
    return OrderTypes.hasDelivery(orderType);
  } catch (e) {
    const t = String(orderType).trim();
    return (
      t === "Counter • Route" ||
      t === "Route • Route" ||
      t === "C • R" ||
      t === "R • R" ||
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
}

function isRoutePickupOrderType(orderType) {
  if (!orderType) return false;
  try {
    const OrderTypes = require("../public/js/shared/orderTypes");
    return OrderTypes.hasPickup(orderType);
  } catch (e) {
    const t = String(orderType).trim();
    return (
      t === "Route • Route" ||
      t === "Route • Counter" ||
      t === "R • R" ||
      t === "R • C" ||
      t === "Route & Route" ||
      t === "Route & Counter" ||
      t === "R & R" ||
      t === "R & C" ||
      t === "Pick-up • Delivery" ||
      t === "Pick-up • Counter" ||
      t === "Pick-up & Delivery" ||
      t === "Pick-up & Counter" ||
      t === "Store collection • Store delivery" ||
      t === "Store collection & Store delivery"
    );
  }
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
 * Normalize phone numbers into E.164 format for Twilio (+1XXXXXXXXXX or +CountryCode...)
 */
function formatE164Phone(rawPhone) {
  if (!rawPhone) return "";
  const str = String(rawPhone).trim();
  const hasPlus = str.startsWith("+");
  const digits = str.replace(/\D/g, "");
  if (!digits) return "";
  if (hasPlus) return `+${digits}`;
  // Standard 10-digit US/Canada number without country code -> prepend +1
  if (digits.length === 10) return `+1${digits}`;
  // 11+ digits starting with country code -> prepend +
  return `+${digits}`;
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
  const rawFromPhone = (storeObj && storeObj.twilio_phone_no && String(storeObj.twilio_phone_no).trim() !== "")
    ? String(storeObj.twilio_phone_no).trim()
    : (effectiveMaster && effectiveMaster.twilio_phone_no ? String(effectiveMaster.twilio_phone_no).trim() : "");
  const fromPhone = formatE164Phone(rawFromPhone);
  const status = (storeObj && storeObj.twilio_status !== undefined && storeObj.twilio_status !== null)
    ? String(storeObj.twilio_status)
    : (effectiveMaster && effectiveMaster.twilio_status !== undefined && effectiveMaster.twilio_status !== null ? String(effectiveMaster.twilio_status) : "1");

  return {
    sid,
    token,
    fromPhone,
    phone: rawFromPhone || fromPhone,
    status,
    isConfigured: Boolean(sid && token && fromPhone && status !== "0")
  };
}

/**
 * Build Subject, HTML Email, and SMS text for any of the 12 events
 * Respects custom templates (store or global) when provided, with {tag} interpolation
 */
function buildNotificationContent({ eventKey, customer, store, master, order, items, extraData, templates = null, rackNames = "" }) {
  const sym = (master && master.currency_symbol) ? master.currency_symbol : "$";
  const storeName = (store && store.name) ? store.name : ((master && master.app_name) ? master.app_name : "iCleaners");
  const storePhone = (store && store.mobile_number) ? store.mobile_number : "";
  const storeEmail = (store && store.store_email) ? store.store_email : "";
  const storeAddress = [store?.address, store?.city, store?.state, store?.zipcode].filter(Boolean).join(", ");
  const custName = formatCustomerDisplayName(customer);

  const orderCode = order ? (order.order_id || order.id) : (extraData?.orderCode || "");
  const orderType = order ? (order.order_type || "Counter • Counter") : "Counter • Counter";
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

  const paidNowNum = parseFloat(extraData?.paidNow || 0);
  const paidNowFormatted = `${sym}${paidNowNum.toFixed(2)}`;
  const paymentMethodStr = extraData?.paymentMethod ? String(extraData.paymentMethod) : "Card / Cash";
  const cancelReasonStr = extraData?.cancelReason || (order && order.note) || "Cancelled by store";
  const resolvedRacks = rackNames || extraData?.rackNames || "";

  const varsMap = {
    customer_name: custName,
    order_id: orderCode,
    store_name: storeName,
    store_phone: storePhone || "our store",
    store_email: storeEmail,
    store_address: storeAddress,
    gross_total: grossTotal,
    paid_amount: paidAmount,
    balance_due: balanceDue,
    total_pieces: totalPieces,
    ready_date: readyDateStr,
    delivery_date: deliveryDateStr,
    pickup_date: pickupDateStr,
    rack_names: resolvedRacks,
    paid_now: paidNowFormatted,
    payment_method: paymentMethodStr,
    cancel_reason: cancelReasonStr
  };

  let badgeText = "Notification";
  let badgeColor = "#2563eb";

  switch (eventKey) {
    case "order_placed":
      badgeText = `Order #${orderCode} Confirmed`;
      badgeColor = "#2563eb";
      break;
    case "route_pickup_scheduled":
      badgeText = `Route Pick-up #${orderCode}`;
      badgeColor = "#0284c7";
      break;
    case "pickup_request_accepted":
      badgeText = `Pick-up Accepted #${orderCode}`;
      badgeColor = "#16a34a";
      break;
    case "route_intake_priced":
      badgeText = `Order #${orderCode} Itemized`;
      badgeColor = "#0d9488";
      break;
    case "order_modified":
      badgeText = `Order #${orderCode} Updated`;
      badgeColor = "#4f46e5";
      break;
    case "order_processing":
      badgeText = `In Process`;
      badgeColor = "#d97706";
      break;
    case "schedule_rescheduled":
      badgeText = `Rescheduled`;
      badgeColor = "#ea580c";
      break;
    case "order_ready_pickup":
      badgeText = `Ready for Counter Pickup`;
      badgeColor = "#16a34a";
      break;
    case "order_out_for_delivery":
      badgeText = `Out for Delivery`;
      badgeColor = "#059669";
      break;
    case "order_delivered":
      badgeText = `Delivered / Completed`;
      badgeColor = "#15803d";
      break;
    case "payment_received":
      badgeText = `Payment Confirmed: ${paidNowFormatted}`;
      badgeColor = "#16a34a";
      break;
    case "order_cancelled":
      badgeText = `Cancelled / Voided`;
      badgeColor = "#dc2626";
      break;
    case "welcome_customer":
      badgeText = `New Customer Profile`;
      badgeColor = "#2563eb";
      break;
    default:
      badgeText = "Notification";
      badgeColor = "#2563eb";
      break;
  }

  const defaultMap = getDefaultTemplatesMap();
  const activeTpl = (templates && templates[eventKey])
    ? templates[eventKey]
    : (defaultMap[eventKey] || {
        emailSubject: "{store_name} Notification",
        emailHeadline: "Update from {store_name}",
        emailBody: "Hi {customer_name}, here is an update from {store_name} regarding Order #{order_id}.",
        smsBody: "Hi {customer_name}, update from {store_name} regarding Order #{order_id}."
      });

  const subject = interpolateTemplate(activeTpl.emailSubject, varsMap);
  const headline = interpolateTemplate(activeTpl.emailHeadline, varsMap);
  const rawEmailBody = interpolateTemplate(activeTpl.emailBody, varsMap);
  const introHtml = `<p style="line-height:1.6;margin-top:0;">${rawEmailBody.replace(/\r?\n/g, "<br>")}</p>`;
  const smsBody = interpolateTemplate(activeTpl.smsBody, varsMap);

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

    const rackBadgeRow = resolvedRacks
      ? `<div><span style="color:#64748b;font-size:12px;">ASSIGNED RACK(S)</span><div style="font-weight:700;font-size:13px;color:#16a34a;">${resolvedRacks}</div></div>`
      : "";
    const pickupBadgeRow = (order.pickup_date && isRoutePickupOrderType(orderType))
      ? `<div><span style="color:#64748b;font-size:12px;">PICK-UP SCHEDULE</span><div style="font-weight:700;font-size:13px;color:#0284c7;">${pickupDateStr}</div></div>`
      : "";

    orderDetailsHtml = `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:18px 0;">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;border-bottom:1px solid #e2e8f0;padding-bottom:10px;">
          <div><span style="color:#64748b;font-size:12px;">ORDER NUMBER</span><div style="font-weight:700;font-size:15px;color:#0f172a;">#${orderCode}</div></div>
          <div><span style="color:#64748b;font-size:12px;">SERVICE TYPE</span><div style="font-weight:600;font-size:13px;color:#0f172a;">${orderType}</div></div>
          ${pickupBadgeRow}
          <div><span style="color:#64748b;font-size:12px;">READY / DELIVERY SCHEDULE</span><div style="font-weight:700;font-size:13px;color:#2563eb;">${readyDateStr}</div></div>
          ${rackBadgeRow}
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
  accessdata = null,
  forceEmail = false,
  forceSms = false,
  overrideRecipient = null
}) {
  try {
    let orderObj = null;
    let itemsList = [];
    let resolvedRackNames = "";

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

        if (orderObj.rack_ids && String(orderObj.rack_ids).trim() !== "") {
          const cleanRacks = String(orderObj.rack_ids)
            .split(",")
            .map((r) => parseInt(r.trim(), 10))
            .filter((n) => !isNaN(n) && n > 0);
          if (cleanRacks.length > 0) {
            const rackRows = await DataFind(
              `SELECT name FROM tbl_racks WHERE id IN (${cleanRacks.join(",")}) AND delet_flage = 0`
            );
            if (rackRows && rackRows.length > 0) {
              resolvedRackNames = rackRows.map((r) => r.name).join(", ");
            }
          }
        }
      }
    }

    const effectiveStoreId = parseInt(storeId, 10) || 0;
    const settings = await getEffectiveNotificationSettings(effectiveStoreId);
    const eventCfg = settings.events[eventKey] || { email: false, sms: false };

    const shouldSendEmail = Boolean(forceEmail || (settings.email_enabled && eventCfg.email));
    const shouldSendSms = Boolean(forceSms || (settings.sms_enabled && eventCfg.sms));
    const shouldSendPush = Boolean(!forceEmail && !forceSms && settings.push_enabled);

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
      extraData,
      templates: settings.templates,
      rackNames: resolvedRackNames
    });

    let sentEmail = false;
    let sentSms = false;
    let sentPush = false;

    // 1. Send Email if enabled/forced and recipient email is available
    const targetEmail = (overrideRecipient && forceEmail)
      ? String(overrideRecipient).trim()
      : ((!isWalkIn && customerObj && customerObj.email) ? String(customerObj.email).trim() : "");

    if (shouldSendEmail && targetEmail !== "") {
      const smtp = await resolveSmtpConfig(effectiveStoreId);
      if (smtp && smtp.host && smtp.port && smtp.username && smtp.password && smtp.frommail) {
        try {
          const port = Number(smtp.port) || 465;
          const transporter = nodemailer.createTransport({
            host: smtp.host,
            port: port,
            secure: port === 465,
            auth: {
              user: smtp.username,
              pass: smtp.password
            },
            tls: {
              rejectUnauthorized: false
            }
          });
          const senderName = (storeObj && storeObj.name) ? storeObj.name.replace(/"/g, "'") : ((masterObj && masterObj.name) ? masterObj.name.replace(/"/g, "'") : "iCleaners");
          const replyToEmail = (storeObj && storeObj.email) ? storeObj.email : ((masterObj && masterObj.email) ? masterObj.email : smtp.frommail);
          await transporter.sendMail({
            from: `"${senderName}" <${smtp.frommail}>`,
            replyTo: replyToEmail,
            to: targetEmail,
            subject: subject,
            text: smsBody || subject,
            html: htmlBody
          });
          sentEmail = true;
        } catch (emailErr) {
          console.error(`[NotificationService] Email error (${eventKey}):`, emailErr.message);
          if (forceEmail) throw emailErr;
        }
      } else if (forceEmail) {
        throw new Error("SMTP mail server is not configured yet. Please configure Mail Settings first.");
      }
    } else if (forceEmail && targetEmail === "") {
      throw new Error("Recipient email address is required.");
    }

    // 2. Send SMS if enabled/forced and recipient phone is available
    const targetPhone = (overrideRecipient && forceSms)
      ? String(overrideRecipient).trim()
      : ((!isWalkIn && customerObj && customerObj.number) ? String(customerObj.number).trim() : "");

    if (shouldSendSms && targetPhone !== "") {
      const twilioCfg = await resolveTwilioConfig(storeObj, masterObj);
      const formattedTo = formatE164Phone(targetPhone);
      if (twilioCfg.isConfigured && formattedTo) {
        try {
          const clientSms = require("twilio")(twilioCfg.sid, twilioCfg.token);
          await clientSms.messages.create({
            body: smsBody,
            from: twilioCfg.fromPhone,
            to: formattedTo
          });
          sentSms = true;
        } catch (twilioErr) {
          console.error(`[NotificationService] Twilio error (${eventKey}):`, twilioErr.message);
          if (forceSms) throw twilioErr;
        }
      } else if (forceSms) {
        if (!formattedTo) {
          throw new Error("Invalid recipient phone number format.");
        }
        throw new Error("Twilio SMS is not configured yet. Please configure Twilio Settings first.");
      }
    } else if (forceSms && targetPhone === "") {
      throw new Error("Recipient phone number is required.");
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
      const port = Number(smtp.port) || 465;
      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: port,
        secure: port === 465,
        auth: {
          user: smtp.username,
          pass: smtp.password
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      const senderName = storeName ? storeName.replace(/"/g, "'") : "iCleaners";
      await transporter.sendMail({
        from: `"${senderName}" <${smtp.frommail}>`,
        replyTo: smtp.frommail,
        to: cleanRecipient,
        subject: `[Test] ${storeName} Notification System Verification`,
        text: `This is a test notification verifying that the ${storeName} email notification system is functioning properly.`,
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

    const formattedRecipient = formatE164Phone(cleanRecipient);
    if (!formattedRecipient) {
      return { success: false, message: "Please enter a valid recipient phone number." };
    }

    try {
      const clientSms = require("twilio")(twilioCfg.sid, twilioCfg.token);
      const msgResult = await clientSms.messages.create({
        body: `[${storeName}] Test SMS successful! Your automated customer SMS notifications are active.`,
        from: twilioCfg.fromPhone,
        to: formattedRecipient
      });
      return {
        success: true,
        sid: msgResult.sid,
        status: msgResult.status,
        to: formattedRecipient,
        from: twilioCfg.fromPhone,
        message: `Test SMS dispatched successfully to ${formattedRecipient}! (Twilio SID: ${msgResult.sid})`
      };
    } catch (err) {
      return { success: false, message: `Twilio SMS Error: ${err.message}` };
    }
  }

  return { success: false, message: "Unsupported test channel." };
}

/**
 * Format structured WhatsApp Invoice Receipt message
 */
function formatWhatsAppInvoiceMessage({ order, items, customer, store, master, rackNames = "" }) {
  const sym = (master && master.currency_symbol) ? master.currency_symbol : "$";
  const storeName = (store && store.name) ? store.name : ((master && master.app_name) ? master.app_name : "iCleaners");
  const storePhone = (store && store.mobile_number) ? store.mobile_number : "";
  const custName = formatCustomerDisplayName(customer);

  const orderCode = order ? (order.order_id || order.id) : "";
  const grossTotal = order ? `${sym}${parseFloat(order.gross_total || 0).toFixed(2)}` : `${sym}0.00`;
  const paidAmount = order ? `${sym}${parseFloat(order.paid_amount || 0).toFixed(2)}` : `${sym}0.00`;
  const balanceDue = order ? `${sym}${parseFloat(order.balance_amount || 0).toFixed(2)}` : `${sym}0.00`;
  const readyDateStr = order ? formatDateTimeReadable(order.ready_date || order.delivery_date) : "TBD";
  const orderDateStr = order ? formatDateTimeReadable(order.order_date, true) : "Today";

  let totalPieces = 0;
  let itemsLines = [];

  if (Array.isArray(items) && items.length > 0) {
    items.forEach((it) => {
      const sName = it.service_name || "Service";
      const qty = parseFloat(it.service_quntity || 1) || 1;
      const pcs = parseInt(it.no_of_items || 1, 10) || 1;
      const totalPcsLine = qty * pcs;
      totalPieces += totalPcsLine;
      const pcsBadge = pcs > 1 ? ` (${pcs} Pcs)` : "";
      const price = parseFloat(it.service_price || 0) * qty;
      itemsLines.push(`• ${sName}${pcsBadge} x ${qty} = ${sym}${price.toFixed(2)}`);
    });
  }

  let lines = [
    `*${storeName}*`,
    `🧾 *INVOICE RECEIPT*`,
    `--------------------------------`,
    `Hello *${custName}*, here is your order receipt:`,
    ``,
    `📋 *Order #:* #${orderCode}`,
    `📅 *Order Date:* ${orderDateStr}`,
    `⏰ *Target Ready:* ${readyDateStr}`,
    `👕 *Total Pieces:* ${totalPieces > 0 ? totalPieces + " Pcs" : "1 Pc"}`
  ];

  if (rackNames && String(rackNames).trim() !== "") {
    lines.push(`📍 *Storage Rack:* ${rackNames}`);
  }

  if (itemsLines.length > 0) {
    lines.push(``);
    lines.push(`*ITEMIZED SERVICES:*`);
    lines = lines.concat(itemsLines);
  }

  lines.push(`--------------------------------`);
  lines.push(`💰 *Gross Total:* ${grossTotal}`);
  lines.push(`💳 *Paid Amount:* ${paidAmount}`);
  lines.push(`❗ *Balance Due:* *${balanceDue}*`);
  lines.push(`--------------------------------`);

  if (storePhone) {
    lines.push(`📞 Questions? Call us at ${storePhone}`);
  }
  lines.push(`Thank you for choosing ${storeName}!`);

  return lines.join("\n");
}

function formatWhatsAppNumber(phone) {
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  // 10-digit number without country code (US/Canada assumption) -> 1XXXXXXXXXX
  if (digits.length === 10) return `1${digits}`;
  return digits;
}

/**
 * Format structured WhatsApp Pick-up Request Acceptance confirmation message
 */
function formatWhatsAppPickupAcceptedMessage({ order, customer, store, master }) {
  const storeName = (store && store.name) ? store.name : ((master && master.app_name) ? master.app_name : "iCleaners");
  const storePhone = (store && store.mobile_number) ? store.mobile_number : "";
  const custName = formatCustomerDisplayName(customer);
  const orderCode = order ? (order.order_id || order.id) : "";
  const orderType = order && order.order_type ? order.order_type : "Pick-up & Delivery";
  const pickupDateStr = order ? formatDateTimeReadable(order.pickup_date || order.order_date) : "Scheduled";
  const readyDateStr = order && (order.ready_date || order.delivery_date) ? formatDateTimeReadable(order.ready_date || order.delivery_date) : "TBD";
  const pickupAddress = (order && order.pickup_address && String(order.pickup_address).trim())
    ? String(order.pickup_address).trim()
    : [customer?.address, customer?.city, customer?.state, customer?.zipcode].filter(Boolean).join(", ");

  const lines = [
    `*${storeName}*`,
    `✅ *PICK-UP REQUEST ACCEPTED*`,
    `--------------------------------`,
    `Hello *${custName}*,`,
    `Your clothes pick-up request *#${orderCode}* has been accepted and scheduled into our route!`,
    ``,
    `📋 *Order #:* #${orderCode}`,
    `🚚 *Service Type:* ${orderType}`,
    `📅 *Confirmed Pick-up:* ${pickupDateStr}`,
  ];

  if (pickupAddress) {
    lines.push(`📍 *Pick-up Address:* ${pickupAddress}`);
  }
  lines.push(`⏰ *Est. Ready Target:* ${readyDateStr}`);

  if (order && order.note && String(order.note).trim() !== "") {
    lines.push(`📝 *Note:* ${String(order.note).trim()}`);
  }

  lines.push(`--------------------------------`);
  lines.push(`Our driver will collect your garments at the scheduled time. Itemized pricing will update once inspected at the store.`);
  if (storePhone) {
    lines.push(`📞 Questions? Call us at ${storePhone}`);
  }
  lines.push(`Thank you for choosing ${storeName}!`);

  return lines.join("\n");
}

module.exports = {
  NOTIFICATION_EVENTS,
  TEMPLATE_VARIABLES,
  getDefaultTemplatesMap,
  getEffectiveNotificationSettings,
  saveNotificationSettings,
  saveNotificationTemplates,
  resetNotificationTemplates,
  saveEmailAndTwilioGateways,
  resetStoreNotificationSettings,
  buildNotificationContent,
  interpolateTemplate,
  dispatchCustomerNotification,
  sendTestNotification,
  resolveSmtpConfig,
  resolveTwilioConfig,
  formatWhatsAppInvoiceMessage,
  formatWhatsAppPickupAcceptedMessage,
  formatWhatsAppNumber,
  isRouteDeliveryOrderType,
  isRoutePickupOrderType
};

