/**
 * Centralized Customer Notification Service (Email, SMS, WhatsApp/Open-WA & Push)
 * Supports two-tier configuration (Global defaults + Per-store overrides)
 * and dispatches notifications across all customer lifecycle events.
 */
const nodemailer = require("nodemailer");
const sendNotification = require("../middelwer/send");
const { DataFind, DataInsert, DataUpdate } = require("../middelwer/databaseQurey");
const { conn } = require("../middelwer/db");

let tableVerified = false;
const openWaSessionUuidCache = new Map();

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
        whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1,
        push_enabled TINYINT(1) NOT NULL DEFAULT 1,
        events_config LONGTEXT NULL,
        templates_config LONGTEXT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY idx_notif_store_id (store_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const [cols] = await promiseConn.query("SHOW COLUMNS FROM tbl_notification_settings");
    const colNames = cols.map((c) => c.Field);
    if (!colNames.includes("whatsapp_enabled")) {
      await promiseConn.query(
        "ALTER TABLE tbl_notification_settings ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 1 AFTER sms_enabled"
      );
    }
    if (!colNames.includes("templates_config")) {
      await promiseConn.query(
        "ALTER TABLE tbl_notification_settings ADD COLUMN templates_config LONGTEXT NULL AFTER events_config"
      );
    }
    tableVerified = true;
  } catch (e) {
    console.error("Warning: ensureSettingsTable failed:", e.message);
  }
}

let commLogsTableVerified = false;

async function ensureCommunicationLogsTable() {
  if (commLogsTableVerified) return;
  try {
    const promiseConn = conn.promise();
    await promiseConn.query(`
      CREATE TABLE IF NOT EXISTS tbl_communication_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        store_id INT NOT NULL DEFAULT 0,
        order_id INT NULL DEFAULT NULL,
        order_code VARCHAR(60) NULL DEFAULT NULL,
        customer_id INT NULL DEFAULT NULL,
        customer_name VARCHAR(150) NULL DEFAULT NULL,
        preference_id INT NULL DEFAULT NULL,
        preference_code VARCHAR(30) NULL DEFAULT NULL,
        event_key VARCHAR(60) NOT NULL DEFAULT 'order_placed',
        channel VARCHAR(20) NOT NULL,
        dispatch_mode VARCHAR(20) NOT NULL DEFAULT 'auto',
        recipient VARCHAR(150) NULL DEFAULT NULL,
        subject VARCHAR(255) NULL DEFAULT NULL,
        message_preview TEXT NULL,
        status VARCHAR(20) NOT NULL,
        provider VARCHAR(40) NULL DEFAULT NULL,
        provider_message_id VARCHAR(150) NULL DEFAULT NULL,
        error_message VARCHAR(500) NULL DEFAULT NULL,
        triggered_by VARCHAR(80) NULL DEFAULT NULL,
        source_page VARCHAR(40) NULL DEFAULT 'pos',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_comm_log_order (order_id),
        INDEX idx_comm_log_customer (customer_id),
        INDEX idx_comm_log_store_date (store_id, created_at),
        INDEX idx_comm_log_channel_status (channel, status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    commLogsTableVerified = true;
  } catch (e) {
    console.error("Warning: ensureCommunicationLogsTable failed:", e.message);
  }
}

async function recordCommunicationLog({
  storeId = 0,
  orderId = null,
  orderCode = null,
  customerId = null,
  customerName = null,
  preferenceId = null,
  preferenceCode = null,
  eventKey = 'order_placed',
  channel = 'none',
  dispatchMode = 'auto',
  recipient = null,
  subject = null,
  messagePreview = null,
  status = 'sent',
  provider = null,
  providerMessageId = null,
  errorMessage = null,
  triggeredBy = null,
  sourcePage = 'pos'
} = {}) {
  try {
    await ensureCommunicationLogsTable();
    const promiseConn = conn.promise();
    const cleanStoreId = parseInt(storeId, 10) || 0;
    const cleanOrderId = orderId ? (parseInt(orderId, 10) || null) : null;
    const cleanOrderCode = orderCode ? String(orderCode).trim().slice(0, 60) : null;
    const cleanCustId = customerId ? (parseInt(customerId, 10) || null) : null;
    const cleanCustName = customerName ? String(customerName).trim().slice(0, 150) : null;
    const cleanPrefId = preferenceId ? (parseInt(preferenceId, 10) || null) : null;
    const cleanPrefCode = preferenceCode ? String(preferenceCode).toLowerCase().trim().slice(0, 30) : null;
    const cleanEventKey = eventKey ? String(eventKey).trim().slice(0, 60) : 'order_placed';
    const cleanChannel = channel ? String(channel).toLowerCase().trim().slice(0, 20) : 'none';
    const cleanMode = dispatchMode ? String(dispatchMode).toLowerCase().trim().slice(0, 20) : 'auto';
    const cleanRecipient = recipient ? String(recipient).trim().slice(0, 150) : null;
    const cleanSubject = subject ? String(subject).trim().slice(0, 255) : null;
    const cleanPreview = messagePreview ? String(messagePreview).slice(0, 1000) : null;
    const cleanStatus = status ? String(status).toLowerCase().trim().slice(0, 20) : 'sent';
    const cleanProvider = provider ? String(provider).trim().slice(0, 40) : null;
    const cleanMsgId = providerMessageId ? String(providerMessageId).trim().slice(0, 150) : null;
    const cleanError = errorMessage ? String(errorMessage).trim().slice(0, 500) : null;
    const cleanTriggered = triggeredBy ? String(triggeredBy).trim().slice(0, 80) : null;
    const cleanSource = sourcePage ? String(sourcePage).trim().slice(0, 40) : 'pos';

    const [insertResult] = await promiseConn.query(
      `INSERT INTO tbl_communication_logs
        (store_id, order_id, order_code, customer_id, customer_name, preference_id, preference_code,
         event_key, channel, dispatch_mode, recipient, subject, message_preview, status,
         provider, provider_message_id, error_message, triggered_by, source_page)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cleanStoreId, cleanOrderId, cleanOrderCode, cleanCustId, cleanCustName, cleanPrefId, cleanPrefCode,
        cleanEventKey, cleanChannel, cleanMode, cleanRecipient, cleanSubject, cleanPreview, cleanStatus,
        cleanProvider, cleanMsgId, cleanError, cleanTriggered, cleanSource
      ]
    );
    return insertResult ? insertResult.insertId : null;
  } catch (err) {
    console.error("Error in recordCommunicationLog:", err.message);
    return null;
  }
}

async function hasOrderChannelAlreadySent(arg1, arg2) {
  let orderId = null;
  let orderCode = null;
  let channel = null;

  if (typeof arg1 === "object" && arg1 !== null) {
    orderId = arg1.orderId;
    orderCode = arg1.orderCode;
    channel = arg1.channel;
  } else {
    orderId = arg1;
    channel = arg2;
  }

  if (!channel || (!orderId && !orderCode)) return false;
  try {
    await ensureCommunicationLogsTable();
    const promiseConn = conn.promise();
    let where = "channel = ? AND status = 'sent'";
    const params = [String(channel).toLowerCase().trim()];
    if (orderId && orderCode) {
      where += " AND (order_id = ? OR order_code = ?)";
      params.push(orderId, orderCode);
    } else if (orderId) {
      where += " AND order_id = ?";
      params.push(orderId);
    } else {
      where += " AND order_code = ?";
      params.push(orderCode);
    }
    const [rows] = await promiseConn.query(`SELECT id FROM tbl_communication_logs WHERE ${where} LIMIT 1`, params);
    return Boolean(rows && rows.length > 0);
  } catch (err) {
    console.error("hasOrderChannelAlreadySent error:", err);
    return false;
  }
}

async function getOrderCommunicationLogs(orderIdOrCode) {
  if (!orderIdOrCode) return [];
  try {
    await ensureCommunicationLogsTable();
    const promiseConn = conn.promise();
    const clean = String(orderIdOrCode).trim();
    const [rows] = await promiseConn.query(
      `SELECT * FROM tbl_communication_logs
       WHERE order_id = ? OR order_code = ?
       ORDER BY id DESC LIMIT 50`,
      [clean, clean]
    );
    return rows || [];
  } catch (err) {
    console.error("getOrderCommunicationLogs error:", err);
    return [];
  }
}

async function getCustomerCommunicationLogs(customerId, limit = 20) {
  if (!customerId) return [];
  try {
    await ensureCommunicationLogsTable();
    const promiseConn = conn.promise();
    const [rows] = await promiseConn.query(
      `SELECT * FROM tbl_communication_logs
       WHERE customer_id = ?
       ORDER BY id DESC LIMIT ?`,
      [parseInt(customerId, 10) || 0, parseInt(limit, 10) || 20]
    );
    return rows || [];
  } catch (err) {
    console.error("getCustomerCommunicationLogs error:", err);
    return [];
  }
}

async function resolveCustomerCommunicationPreference(customerObjOrId) {
  if (!customerObjOrId || customerObjOrId === "0" || customerObjOrId === 0) {
    return { preferenceId: null, preferenceCode: 'not_set', preferenceName: 'Not Set', isPrintOnly: true };
  }
  let prefId = null;
  if (typeof customerObjOrId === "object") {
    prefId = customerObjOrId.communication_preference_id;
  } else {
    try {
      const promiseConn = conn.promise();
      const [cRows] = await promiseConn.query(
        `SELECT communication_preference_id FROM tbl_customer WHERE id = ? LIMIT 1`,
        [customerObjOrId]
      );
      if (cRows && cRows.length > 0) {
        prefId = cRows[0].communication_preference_id;
      }
    } catch (err) {
      console.error("resolveCustomerCommunicationPreference customer lookup error:", err);
    }
  }

  if (!prefId || String(prefId) === '0' || String(prefId).trim() === '') {
    return { preferenceId: null, preferenceCode: 'not_set', preferenceName: 'Not Set', isPrintOnly: true };
  }
  try {
    const promiseConn = conn.promise();
    const [rows] = await promiseConn.query(
      `SELECT id, code, name FROM tbl_communication_preferences WHERE id = ? LIMIT 1`,
      [parseInt(prefId, 10)]
    );
    if (rows && rows.length > 0) {
      const code = String(rows[0].code || '').toLowerCase().trim();
      return {
        preferenceId: rows[0].id,
        preferenceCode: code,
        preferenceName: rows[0].name || 'Not Set',
        isPrintOnly: code === 'print' || code === 'not_set'
      };
    }
  } catch (err) {
    console.error("resolveCustomerCommunicationPreference error:", err);
  }
  return { preferenceId: null, preferenceCode: 'not_set', preferenceName: 'Not Set', isPrintOnly: true };
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Order Confirmation #{order_id} - {store_name}",
    defaultEmailHeadline: "Thank You for Your Order!",
    defaultEmailBody: "Hi {customer_name}, we have received your garments at {store_name}. Below is your order summary and target completion schedule.",
    defaultSmsBody: "Hi {customer_name}, thank you for your order #{order_id} at {store_name} ({total_pieces} pcs)! Total: {gross_total} (Balance: {balance_due}). Ready by: {ready_date}.",
    defaultWhatsappBody: "🧾 *ORDER CONFIRMATION #{order_id}*\nHello *{customer_name}*, thank you for choosing *{store_name}*! We have received your garments ({total_pieces} pcs).\n⏰ *Target Ready:* {ready_date}",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Route Pick-up Scheduled (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Garment Pick-up is Scheduled",
    defaultEmailBody: "Hi {customer_name}, your route garment pick-up with {store_name} has been scheduled for {pickup_date}. Once our driver brings your garments to the store, we will inspect, itemize, and send you your updated order total.",
    defaultSmsBody: "Hi {customer_name}, your garment pick-up (#{order_id}) with {store_name} is scheduled for {pickup_date}. Call {store_phone} for any special instructions.",
    defaultWhatsappBody: "🚚 *ROUTE PICK-UP SCHEDULED (#{order_id})*\nHello *{customer_name}*, your garment pick-up with *{store_name}* is scheduled for *{pickup_date}*.\nOnce our driver collects your garments, we will inspect, itemize, and send your updated receipt.",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Pick-up Request Accepted (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Pick-up Request Has Been Accepted!",
    defaultEmailBody: "Hi {customer_name}, great news! Your clothes pick-up request #{order_id} with {store_name} has been accepted and scheduled for {pickup_date}. Our driver will collect your garments at the scheduled time.",
    defaultSmsBody: "Hi {customer_name}, your pick-up request #{order_id} at {store_name} has been ACCEPTED! Confirmed pick-up: {pickup_date}. Call {store_phone} for any questions.",
    defaultWhatsappBody: "✅ *PICK-UP REQUEST ACCEPTED (#{order_id})*\nHello *{customer_name}*, great news! Your pick-up request with *{store_name}* has been accepted.\n📅 *Confirmed Pick-up:* {pickup_date}\n⏰ *Est. Ready Target:* {ready_date}\nOur driver will collect your garments at the scheduled window.",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Your Garments Have Been Itemized (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Route Pick-up Inspected & Priced",
    defaultEmailBody: "Hi {customer_name}, we have received and inspected the garments collected during your route pick-up ({total_pieces} piece(s)). Here is your itemized order breakdown and completion schedule.",
    defaultSmsBody: "Hi {customer_name}, we have inspected & itemized your garments for Order #{order_id} ({total_pieces} pcs) at {store_name}. Total: {gross_total} (Balance: {balance_due}). Ready/Delivery: {ready_date}.",
    defaultWhatsappBody: "📋 *GARMENTS ITEMIZED & PRICED (#{order_id})*\nHello *{customer_name}*, we have inspected the garments from your route pick-up at *{store_name}* ({total_pieces} pcs).\n⏰ *Ready / Delivery:* {ready_date}",
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
    defaultWhatsapp: false,
    defaultEmailSubject: "Order Updated (#{order_id}) - {store_name}",
    defaultEmailHeadline: "Your Order Details Have Been Updated",
    defaultEmailBody: "Hi {customer_name}, your order #{order_id} at {store_name} has been updated. Please review the revised summary below.",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been updated. Revised Total: {gross_total} (Balance Due: {balance_due}).",
    defaultWhatsappBody: "✏️ *ORDER UPDATED (#{order_id})*\nHello *{customer_name}*, your order at *{store_name}* has been updated. Please review your revised receipt summary below.",
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
    defaultWhatsapp: false,
    defaultEmailSubject: "Your Order #{order_id} is In Process - {store_name}",
    defaultEmailHeadline: "Garments In Cleaning Process",
    defaultEmailBody: "Hi {customer_name}, your garments for Order #{order_id} are currently being cleaned and cared for by our specialists at {store_name}.",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} is now in cleaning process at {store_name}. Estimated ready date: {ready_date}.",
    defaultWhatsappBody: "🧺 *GARMENTS IN PROCESS (#{order_id})*\nHello *{customer_name}*, your garments are now being cleaned and cared for by our team at *{store_name}*.\n⏰ *Estimated Ready:* {ready_date}",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Updated Schedule for Order #{order_id} - {store_name}",
    defaultEmailHeadline: "Order Schedule Updated",
    defaultEmailBody: "Hi {customer_name}, the completion/delivery schedule for your Order #{order_id} at {store_name} has been updated to {ready_date}.",
    defaultSmsBody: "Hi {customer_name}, the schedule for your Order #{order_id} at {store_name} has been updated. New Ready/Delivery schedule: {ready_date}.",
    defaultWhatsappBody: "📅 *SCHEDULE UPDATED (#{order_id})*\nHello *{customer_name}*, the schedule for your order at *{store_name}* has been updated.\n⏰ *New Target Schedule:* {ready_date}",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Your Order #{order_id} is Ready for Pickup! - {store_name}",
    defaultEmailHeadline: "Your Garments Are Clean & Ready!",
    defaultEmailBody: "Good news, {customer_name}! Your Order #{order_id} ({total_pieces} piece(s)) is clean, pressed, and ready for pickup at {store_name}.",
    defaultSmsBody: "Good news {customer_name}! Your Order #{order_id} ({total_pieces} pcs) at {store_name} is clean and READY for pickup. Balance Due: {balance_due}.",
    defaultWhatsappBody: "✨ *READY FOR PICKUP (#{order_id})*\nGood news *{customer_name}*! Your order ({total_pieces} pcs) at *{store_name}* is clean, pressed, and ready for counter pickup.\n📍 *Store:* {store_address}",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Your Order #{order_id} is Ready for Route Delivery - {store_name}",
    defaultEmailHeadline: "Scheduled for Route Delivery",
    defaultEmailBody: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} piece(s)) are ready and scheduled for route delivery on {delivery_date}.",
    defaultSmsBody: "Hi {customer_name}, your clean garments for Order #{order_id} ({total_pieces} pcs) from {store_name} are ready for delivery on {delivery_date}. Balance Due: {balance_due}.",
    defaultWhatsappBody: "🚐 *READY FOR ROUTE DELIVERY (#{order_id})*\nHello *{customer_name}*, your clean garments ({total_pieces} pcs) from *{store_name}* are ready and scheduled for delivery on *{delivery_date}*.",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Order #{order_id} Completed & Delivered - {store_name}",
    defaultEmailHeadline: "Order Completed — Thank You!",
    defaultEmailBody: "Thank you, {customer_name}! Your Order #{order_id} has been marked as completed and delivered. We truly appreciate your trust in {store_name}.",
    defaultSmsBody: "Thank you {customer_name}! Your Order #{order_id} from {store_name} has been completed and delivered. We appreciate your business!",
    defaultWhatsappBody: "🎉 *ORDER COMPLETED & DELIVERED (#{order_id})*\nThank you *{customer_name}*! Your order from *{store_name}* has been completed and delivered. We appreciate your business!",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Payment Receipt for Order #{order_id} - {store_name}",
    defaultEmailHeadline: "Payment Received — Thank You!",
    defaultEmailBody: "Hi {customer_name}, we have received your payment of {paid_now} for Order #{order_id} at {store_name}.",
    defaultSmsBody: "Payment confirmed! We received {paid_now} for Order #{order_id} at {store_name}. Remaining Balance: {balance_due}. Thank you!",
    defaultWhatsappBody: "💳 *PAYMENT RECEIVED (#{order_id})*\nHello *{customer_name}*, we received your payment of *{paid_now}* ({payment_method}) at *{store_name}*.\n💰 *Remaining Balance:* {balance_due}",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Order #{order_id} Cancelled - {store_name}",
    defaultEmailHeadline: "Order Cancellation Notice",
    defaultEmailBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled/voided. Reason: {cancel_reason}",
    defaultSmsBody: "Hi {customer_name}, your Order #{order_id} at {store_name} has been cancelled ({cancel_reason}). Please call {store_phone} if you have any questions.",
    defaultWhatsappBody: "❌ *ORDER CANCELLED (#{order_id})*\nHello *{customer_name}*, your order at *{store_name}* has been cancelled/voided.\n📝 *Reason:* {cancel_reason}\n📞 Questions? Call us at {store_phone}.",
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
    defaultWhatsapp: true,
    defaultEmailSubject: "Welcome to {store_name}, {customer_name}!",
    defaultEmailHeadline: "Welcome to {store_name}!",
    defaultEmailBody: "Hi {customer_name}, welcome to {store_name}! Your customer profile has been registered. Whether you prefer counter drop-off or route pick-up & delivery, we look forward to caring for your garments.",
    defaultSmsBody: "Welcome to {store_name}, {customer_name}! Your customer profile is active. Call us at {store_phone} anytime for dry cleaning & laundry service.",
    defaultWhatsappBody: "👋 *WELCOME TO {store_name}!*\nHello *{customer_name}*, your customer profile is now active! Whether you prefer counter drop-off or route pick-up & delivery, we look forward to caring for your garments.\n📞 Store Phone: {store_phone}",
    sampleSms: "Welcome to {store_name}, {customer_name}! Your customer profile is active. Call us at {store_phone} anytime for dry cleaning & laundry service."
  }
];

function getDefaultEventsMap() {
  const map = {};
  NOTIFICATION_EVENTS.forEach((ev) => {
    map[ev.key] = {
      email: Boolean(ev.defaultEmail),
      sms: Boolean(ev.defaultSms),
      whatsapp: ev.defaultWhatsapp !== undefined ? Boolean(ev.defaultWhatsapp) : Boolean(ev.defaultSms)
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
      smsBody: ev.defaultSmsBody,
      whatsappBody: ev.defaultWhatsappBody || ev.defaultSmsBody
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
          if (typeof custom.whatsappBody === "string" && custom.whatsappBody.trim() !== "") {
            base[ev.key].whatsappBody = custom.whatsappBody.trim();
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
            sms: parsed[ev.key].sms !== undefined ? Boolean(parsed[ev.key].sms) : base[ev.key].sms,
            whatsapp: parsed[ev.key].whatsapp !== undefined ? Boolean(parsed[ev.key].whatsapp) : base[ev.key].whatsapp
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
        a.smsBody !== b.smsBody ||
        a.whatsappBody !== b.whatsappBody
      );
    });
    return flags;
  };

  let globalSettings = {
    store_id: 0,
    is_custom_store_override: false,
    email_enabled: globalRow ? Number(globalRow.email_enabled) === 1 : true,
    sms_enabled: globalRow ? Number(globalRow.sms_enabled) === 1 : true,
    whatsapp_enabled: globalRow && globalRow.whatsapp_enabled !== undefined ? Number(globalRow.whatsapp_enabled) === 1 : true,
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
    whatsapp_enabled: sRow.whatsapp_enabled !== undefined ? Number(sRow.whatsapp_enabled) === 1 : globalSettings.whatsapp_enabled,
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
  const whatsappEnabled = (bodyData.whatsapp_enabled == "1" || bodyData.whatsapp_enabled === "on" || bodyData.whatsapp_enabled === true) ? 1 : 0;
  const pushEnabled = (bodyData.push_enabled == "1" || bodyData.push_enabled === "on" || bodyData.push_enabled === true) ? 1 : 0;

  const eventsMap = {};
  NOTIFICATION_EVENTS.forEach((ev) => {
    const emailField = `event_${ev.key}_email`;
    const smsField = `event_${ev.key}_sms`;
    const waField = `event_${ev.key}_whatsapp`;
    eventsMap[ev.key] = {
      email: (bodyData[emailField] == "1" || bodyData[emailField] === "on" || bodyData[emailField] === true),
      sms: (bodyData[smsField] == "1" || bodyData[smsField] === "on" || bodyData[smsField] === true),
      whatsapp: (bodyData[waField] == "1" || bodyData[waField] === "on" || bodyData[waField] === true)
    };
  });

  const jsonStr = JSON.stringify(eventsMap).replace(/'/g, "\\'");
  const existing = await DataFind(`SELECT id FROM tbl_notification_settings WHERE store_id = ${cleanStoreId} LIMIT 1`);

  if (existing && existing.length > 0) {
    await DataUpdate(
      "tbl_notification_settings",
      `email_enabled = ${emailEnabled}, sms_enabled = ${smsEnabled}, whatsapp_enabled = ${whatsappEnabled}, push_enabled = ${pushEnabled}, events_config = '${jsonStr}'`,
      `store_id = ${cleanStoreId}`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  } else {
    await DataInsert(
      "tbl_notification_settings",
      `store_id, email_enabled, sms_enabled, whatsapp_enabled, push_enabled, events_config`,
      `${cleanStoreId}, ${emailEnabled}, ${smsEnabled}, ${whatsappEnabled}, ${pushEnabled}, '${jsonStr}'`,
      req ? req.hostname : "localhost",
      req ? req.protocol : "http"
    );
  }
  return true;
}

/**
 * Save Email (SMTP), Twilio (SMS), and Open-WA (WhatsApp) Gateway Settings for storeId (0 = Global Master, >0 = Store)
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

  // 3. Save Open-WA (WhatsApp) Gateway settings into tbl_store (if storeId > 0) or tbl_master_shop (if storeId === 0)
  if (
    bodyData.openwa_base_url !== undefined ||
    bodyData.openwa_api_key !== undefined ||
    bodyData.openwa_session_id !== undefined ||
    bodyData.openwa_country_code !== undefined ||
    bodyData.openwa_status !== undefined
  ) {
    const safeBaseUrl = String(bodyData.openwa_base_url || "").trim().replace(/\/+$/, "").replace(/'/g, "\\'");
    const safeApiKey = String(bodyData.openwa_api_key || "").trim().replace(/'/g, "\\'");
    const safeSession = String(bodyData.openwa_session_id || "").trim().replace(/'/g, "\\'");
    const safeCountryCode = String(bodyData.openwa_country_code || "1").replace(/\D/g, "").slice(0, 5) || "1";
    const safeOpenWaStatus = (bodyData.openwa_status === "0" || bodyData.openwa_status === 0 || bodyData.openwa_status === false) ? 0 : 1;

    if (cleanStoreId > 0) {
      await DataUpdate(
        "tbl_store",
        `openwa_base_url='${safeBaseUrl}', openwa_api_key='${safeApiKey}', openwa_session_id='${safeSession}', openwa_country_code='${safeCountryCode}', openwa_status=${safeOpenWaStatus}`,
        `id=${cleanStoreId}`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    } else {
      await DataUpdate(
        "tbl_master_shop",
        `openwa_base_url='${safeBaseUrl}', openwa_api_key='${safeApiKey}', openwa_session_id='${safeSession}', openwa_country_code='${safeCountryCode}', openwa_status=${safeOpenWaStatus}`,
        `id=1`,
        req ? req.hostname : "localhost",
        req ? req.protocol : "http"
      );
    }
    openWaSessionUuidCache.clear();
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
    const waKey = `tpl_${ev.key}_whatsappBody`;

    if (
      bodyData[subjKey] !== undefined ||
      bodyData[headKey] !== undefined ||
      bodyData[bodyKey] !== undefined ||
      bodyData[smsKey] !== undefined ||
      bodyData[waKey] !== undefined
    ) {
      const prev = currentTemplates[ev.key] || {};
      currentTemplates[ev.key] = {
        emailSubject: bodyData[subjKey] !== undefined ? String(bodyData[subjKey]).trim() : (prev.emailSubject || ev.defaultEmailSubject || ""),
        emailHeadline: bodyData[headKey] !== undefined ? String(bodyData[headKey]).trim() : (prev.emailHeadline || ev.defaultEmailHeadline || ""),
        emailBody: bodyData[bodyKey] !== undefined ? String(bodyData[bodyKey]).trim() : (prev.emailBody || ev.defaultEmailBody || ""),
        smsBody: bodyData[smsKey] !== undefined ? String(bodyData[smsKey]).trim() : (prev.smsBody || ev.defaultSmsBody || ""),
        whatsappBody: bodyData[waKey] !== undefined ? String(bodyData[waKey]).trim() : (prev.whatsappBody || ev.defaultWhatsappBody || ev.defaultSmsBody || "")
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
      `store_id, email_enabled, sms_enabled, whatsapp_enabled, push_enabled, events_config, templates_config`,
      `${cleanStoreId}, 1, 1, 1, 1, '${defaultEventsJson}', '${jsonStr}'`,
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
 * Normalize phone numbers into WhatsApp JID (<digits>@c.us) for Open-WA
 */
function formatOpenWaChatId(rawPhone, defaultCountryCode = "1") {
  if (!rawPhone) return "";
  const trimmed = String(rawPhone).trim();
  if (!trimmed) return "";

  // Allow explicit WhatsApp JIDs (individual @c.us, group @g.us, or @lid)
  if (/@(c\.us|g\.us|lid|s\.whatsapp\.net)$/i.test(trimmed)) {
    return trimmed;
  }

  const cleanCC = String(defaultCountryCode || "1").replace(/\D/g, "") || "1";
  const hasPlus = trimmed.startsWith("+");
  const hasDoubleZero = trimmed.startsWith("00");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits || digits.length < 7) return "";

  let resolvedDigits = digits;
  if (hasPlus) {
    resolvedDigits = digits;
  } else if (hasDoubleZero && digits.length > 9) {
    resolvedDigits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith("03")) {
    // Common Pakistan mobile format 03XXXXXXXXX -> 923XXXXXXXXX
    resolvedDigits = `92${digits.slice(1)}`;
  } else if (digits.length === 10) {
    resolvedDigits = `${cleanCC}${digits}`;
  } else if (digits.startsWith("0") && digits.length >= 10) {
    resolvedDigits = `${cleanCC}${digits.slice(1)}`;
  }

  return `${resolvedDigits}@c.us`;
}

/**
 * Resolve Open-WA credentials for a store (two-tier fallback: tbl_store -> tbl_master_shop -> config.env)
 * Accepts either (storeId) OR (storeObj, masterObj)
 */
async function resolveOpenWaConfig(storeOrId, masterObj) {
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

  const pickVal = (storeKey, envKey) => {
    if (storeObj && storeObj[storeKey] && String(storeObj[storeKey]).trim() !== "") {
      return { value: String(storeObj[storeKey]).trim(), fromStore: true };
    }
    if (effectiveMaster && effectiveMaster[storeKey] && String(effectiveMaster[storeKey]).trim() !== "") {
      return { value: String(effectiveMaster[storeKey]).trim(), fromStore: false };
    }
    if (envKey && process.env[envKey] && String(process.env[envKey]).trim() !== "") {
      return { value: String(process.env[envKey]).trim(), fromStore: false };
    }
    return { value: "", fromStore: false };
  };

  const baseRes = pickVal("openwa_base_url", "OPENWA_BASE_URL");
  const keyRes = pickVal("openwa_api_key", "OPENWA_API_KEY");
  const sessRes = pickVal("openwa_session_id", "OPENWA_SESSION_ID");
  const ccRes = pickVal("openwa_country_code", "OPENWA_DEFAULT_COUNTRY_CODE");

  const baseUrl = (baseRes.value || "").replace(/\/+$/, "");
  const apiKey = keyRes.value || "";
  const sessionId = sessRes.value || "";
  const defaultCountryCode = String(ccRes.value || "1").replace(/\D/g, "") || "1";

  const status = (storeObj && storeObj.openwa_status !== undefined && storeObj.openwa_status !== null)
    ? String(storeObj.openwa_status)
    : (effectiveMaster && effectiveMaster.openwa_status !== undefined && effectiveMaster.openwa_status !== null
      ? String(effectiveMaster.openwa_status)
      : "1");

  return {
    baseUrl,
    apiKey,
    sessionId,
    defaultCountryCode,
    status,
    hasStoreOverride: Boolean(baseRes.fromStore || keyRes.fromStore || sessRes.fromStore),
    isConfigured: Boolean(baseUrl && apiKey && sessionId && status !== "0")
  };
}

/**
 * Low-level HTTP fetch helper for Open-WA API with AbortController timeout
 */
async function openWaRequest(cfg, apiPath, options = {}) {
  const cleanBase = String(cfg?.baseUrl || "").trim().replace(/\/+$/, "");
  const cleanKey = String(cfg?.apiKey || "").trim();
  if (!cleanBase || !cleanKey) {
    throw new Error("Open-WA Base URL and API Key are required.");
  }

  const timeoutMs = options.timeoutMs || 10000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${cleanBase}${apiPath}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": cleanKey,
        ...(options.headers || {})
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal
    });

    const rawText = await res.text();
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch (_) {
      parsed = { raw: rawText };
    }

    if (!res.ok) {
      const msg = (parsed && (parsed.message || parsed.error)) || `Open-WA HTTP ${res.status}`;
      const err = new Error(Array.isArray(msg) ? msg.join(", ") : String(msg));
      err.status = res.status;
      err.payload = parsed;
      throw err;
    }

    return parsed;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error(`Open-WA request timed out after ${timeoutMs}ms (${cleanBase})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * List all sessions registered on the configured Open-WA server
 */
async function listOpenWaSessions(cfg) {
  const sessions = await openWaRequest(cfg, "/api/sessions", { timeoutMs: 8000 });
  return Array.isArray(sessions) ? sessions : [];
}

/**
 * Resolve configured session name or UUID to live Open-WA session record
 */
async function resolveOpenWaSession(cfg, forceRefresh = false) {
  const target = String(cfg?.sessionId || "").trim();
  if (!target) {
    throw new Error("Open-WA Session Name or UUID is not configured.");
  }

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(target);
  const cacheKey = `${cfg.baseUrl}|${target}`;

  if (!forceRefresh) {
    const cached = openWaSessionUuidCache.get(cacheKey);
    if (cached && (Date.now() - cached.cachedAt) < 60000) {
      return cached.session;
    }
  }

  if (isUuid && forceRefresh) {
    const direct = await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(target)}`, { timeoutMs: 8000 });
    openWaSessionUuidCache.set(cacheKey, { session: direct, cachedAt: Date.now() });
    return direct;
  }

  const sessions = await listOpenWaSessions(cfg);
  const lowerTarget = target.toLowerCase();
  const matched = sessions.find(
    (s) => String(s.id || "").toLowerCase() === lowerTarget || String(s.name || "").toLowerCase() === lowerTarget
  );

  if (!matched) {
    return null;
  }

  openWaSessionUuidCache.set(cacheKey, { session: matched, cachedAt: Date.now() });
  return matched;
}

/**
 * Fetch live Open-WA session status and QR code (starts or creates session if requested)
 */
async function getOpenWaSessionStatusAndQr({ storeId = 0, baseUrl, apiKey, sessionId, autoStart = false, createIfMissing = false } = {}) {
  const resolved = await resolveOpenWaConfig(storeId);
  const cfg = {
    baseUrl: (baseUrl !== undefined && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : resolved.baseUrl,
    apiKey: (apiKey !== undefined && String(apiKey).trim() !== "") ? String(apiKey).trim() : resolved.apiKey,
    sessionId: (sessionId !== undefined && String(sessionId).trim() !== "") ? String(sessionId).trim() : resolved.sessionId,
    defaultCountryCode: resolved.defaultCountryCode,
    status: "1"
  };

  if (!cfg.baseUrl || !cfg.apiKey) {
    return { success: false, message: "Open-WA Base URL and API Key must be configured first." };
  }

  const allSessions = await listOpenWaSessions(cfg);
  let session = null;
  if (cfg.sessionId) {
    const lowerTarget = cfg.sessionId.toLowerCase();
    session = allSessions.find(
      (s) => String(s.id || "").toLowerCase() === lowerTarget || String(s.name || "").toLowerCase() === lowerTarget
    ) || null;
  }

  if (!session && createIfMissing && cfg.sessionId) {
    const safeName = cfg.sessionId.replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 50);
    session = await openWaRequest(cfg, "/api/sessions", {
      method: "POST",
      body: { name: safeName, config: { autoReconnect: true } },
      timeoutMs: 12000
    });
    if (session && session.id) {
      await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/start`, {
        method: "POST",
        timeoutMs: 15000
      });
      session = await resolveOpenWaSession({ ...cfg, sessionId: session.id }, true);
    }
  } else if (session && autoStart && ["created", "disconnected", "failed"].includes(String(session.status || "").toLowerCase()) && !session.engineLoaded) {
    await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/start`, {
      method: "POST",
      timeoutMs: 15000
    });
    session = await resolveOpenWaSession({ ...cfg, sessionId: session.id }, true);
  }

  let qrCode = null;
  if (session && session.id && ["qr_ready", "initializing", "authenticating"].includes(String(session.status || "").toLowerCase())) {
    try {
      const qrRes = await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/qr`, { timeoutMs: 8000 });
      if (qrRes && qrRes.qrCode) {
        qrCode = qrRes.qrCode;
      }
    } catch (_) {
      // QR may not be ready yet if still initializing
    }
  }

  return {
    success: true,
    session,
    qrCode,
    sessions: allSessions.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      phone: s.phone || null,
      pushName: s.pushName || null,
      engineLoaded: Boolean(s.engineLoaded)
    }))
  };
}

/**
 * Send a WhatsApp text message via Open-WA API
 */
async function sendOpenWaTextMessage({ storeId = 0, storeObj = null, masterObj = null, recipientPhone = "", text = "", overrideConfig = null }) {
  const baseCfg = storeObj ? await resolveOpenWaConfig(storeObj, masterObj) : await resolveOpenWaConfig(storeId, masterObj);
  const cfg = overrideConfig ? { ...baseCfg, ...overrideConfig } : baseCfg;

  if (!cfg.baseUrl || !cfg.apiKey || !cfg.sessionId) {
    return {
      success: false,
      notConfigured: true,
      message: "Open-WA WhatsApp gateway is not configured yet (Base URL, API Key, or Session missing)."
    };
  }
  if (String(cfg.status) === "0") {
    return {
      success: false,
      paused: true,
      message: "Open-WA WhatsApp gateway is currently paused in Notification Settings."
    };
  }

  const chatId = formatOpenWaChatId(recipientPhone, cfg.defaultCountryCode);
  if (!chatId) {
    return {
      success: false,
      invalidPhone: true,
      message: "Please provide a valid recipient phone number with country/area code."
    };
  }

  const cleanText = String(text || "").trim().slice(0, 4096);
  if (!cleanText) {
    return { success: false, message: "WhatsApp message body cannot be empty." };
  }

  let session = await resolveOpenWaSession(cfg, false);
  if (!session || !session.id) {
    openWaSessionUuidCache.clear();
    session = await resolveOpenWaSession(cfg, true);
  }
  if (!session || !session.id) {
    return {
      success: false,
      message: `Open-WA session '${cfg.sessionId}' was not found on ${cfg.baseUrl}.`
    };
  }

  // Verify live session status when cached or previously non-ready
  if (String(session.status || "").toLowerCase() !== "ready") {
    session = await resolveOpenWaSession(cfg, true);
  }
  const st = String(session?.status || "").toLowerCase();
  if (st !== "ready") {
    return {
      success: false,
      sessionNotReady: true,
      sessionStatus: st,
      message: st === "qr_ready"
        ? `Open-WA session '${session.name}' is waiting for QR code scan. Open Notification Settings -> Scan WhatsApp QR to link your phone.`
        : `Open-WA session '${session.name}' is currently '${st}' (not connected).`
    };
  }

  try {
    const resp = await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/messages/send-text`, {
      method: "POST",
      body: { chatId, text: cleanText },
      timeoutMs: 10000
    });
    return {
      success: true,
      messageId: resp?.messageId || null,
      timestamp: resp?.timestamp || null,
      chatId,
      sessionName: session.name,
      sessionId: session.id
    };
  } catch (sendErr) {
    // If session changed status/UUID, invalidate cache once
    openWaSessionUuidCache.delete(`${cfg.baseUrl}|${cfg.sessionId}`);
    return {
      success: false,
      message: sendErr.message || "Failed to send WhatsApp message via Open-WA."
    };
  }
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
 * Build itemized WhatsApp order summary block appended to order lifecycle WhatsApp notifications
 */
function buildWhatsAppOrderSummaryBlock({ eventKey, order, items, sym, grossTotal, paidAmount, balanceDue, resolvedRacks, storeName, storePhone }) {
  if (!order) return "";
  const lines = [];
  const showItemListEvents = new Set([
    "order_placed",
    "route_intake_priced",
    "order_modified",
    "order_ready_pickup",
    "order_out_for_delivery",
    "order_delivered"
  ]);

  if (showItemListEvents.has(eventKey) && Array.isArray(items) && items.length > 0) {
    lines.push("");
    lines.push("*ITEMIZED GARMENTS:*");
    items.forEach((it) => {
      const sName = it.service_name || "Service";
      const sType = it.service_type_name ? ` [${it.service_type_name}]` : "";
      const qty = parseFloat(it.service_quntity || 1) || 1;
      const pcs = parseInt(it.no_of_items || 1, 10) || 1;
      const pcsBadge = pcs > 1 ? ` (${pcs} Pcs)` : "";
      const unitPrice = parseFloat(it.service_type_price || it.service_price || 0) || 0;
      const lineTotal = unitPrice * qty;
      lines.push(`• ${sName}${sType}${pcsBadge} x ${qty} = ${sym}${lineTotal.toFixed(2)}`);
    });
  }

  if (resolvedRacks && String(resolvedRacks).trim() !== "") {
    lines.push(`📍 *Storage Rack(s):* ${resolvedRacks}`);
  }

  const hasFinancialSummary = (Array.isArray(items) && items.length > 0) || parseFloat(order.gross_total || 0) > 0 || eventKey === "payment_received";
  if (hasFinancialSummary && eventKey !== "order_cancelled") {
    lines.push("--------------------------------");
    lines.push(`💰 *Gross Total:* ${grossTotal}`);
    lines.push(`💳 *Paid Amount:* ${paidAmount}`);
    lines.push(`❗ *Balance Due:* *${balanceDue}*`);
  }

  if (storePhone && eventKey !== "order_cancelled" && eventKey !== "welcome_customer") {
    lines.push(`📞 Questions? Call ${storeName} at ${storePhone}`);
  }

  return lines.join("\n");
}

/**
 * Build Subject, HTML Email, SMS text, and WhatsApp text for any of the 12 events
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
        smsBody: "Hi {customer_name}, update from {store_name} regarding Order #{order_id}.",
        whatsappBody: "Hi *{customer_name}*, update from *{store_name}* regarding Order *#{order_id}*."
      });

  const subject = interpolateTemplate(activeTpl.emailSubject, varsMap);
  const headline = interpolateTemplate(activeTpl.emailHeadline, varsMap);
  const rawEmailBody = interpolateTemplate(activeTpl.emailBody, varsMap);
  const introHtml = `<p style="line-height:1.6;margin-top:0;">${rawEmailBody.replace(/\r?\n/g, "<br>")}</p>`;
  const smsBody = interpolateTemplate(activeTpl.smsBody, varsMap);
  const rawWaBody = interpolateTemplate(activeTpl.whatsappBody || activeTpl.smsBody, varsMap);
  const waSummaryBlock = buildWhatsAppOrderSummaryBlock({
    eventKey,
    order,
    items,
    sym,
    grossTotal,
    paidAmount,
    balanceDue,
    resolvedRacks,
    storeName,
    storePhone
  });
  const whatsappBody = waSummaryBlock ? `${rawWaBody}\n${waSummaryBlock}` : rawWaBody;

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

  return { subject, htmlBody, smsBody, whatsappBody };
}

/**
 * Main Dispatcher: Checks Notification Settings and sends Email, SMS, WhatsApp (Open-WA), and Push
 * Respects customer's saved communication preference (Print, Email, SMS, Chat, or Not Set)
 * and records full audit entries in tbl_communication_logs.
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
  forceWhatsapp = false,
  overrideRecipient = null,
  customMessage = null,
  dispatchMode = 'auto',
  triggeredBy = null,
  sourcePage = 'pos',
  skipPreferenceCheck = false
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
              `SELECT rack_name FROM tbl_racks WHERE id IN (${cleanRacks.join(",")}) AND delet_flage = 0`
            );
            if (rackRows && rackRows.length > 0) {
              resolvedRackNames = rackRows.map((r) => r.rack_name || r.name).filter(Boolean).join(", ");
            }
          }
        }
      }
    }

    const effectiveStoreId = parseInt(storeId, 10) || 0;
    const settings = await getEffectiveNotificationSettings(effectiveStoreId);
    const eventCfg = settings.events[eventKey] || { email: false, sms: false, whatsapp: false };

    let customerObj = null;
    if (customerId && String(customerId) !== "0") {
      const cleanCustId = String(customerId).trim().replace(/'/g, "\\'");
      const custRows = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${cleanCustId}' LIMIT 1`);
      if (custRows && custRows.length > 0) {
        customerObj = custRows[0];
      }
    }

    const isWalkIn = !customerObj ||
      (customerObj.name && customerObj.name.toLowerCase().includes("walk in")) ||
      (customerObj.name && customerObj.name.toLowerCase().includes("walkin"));

    const pref = await resolveCustomerCommunicationPreference(customerObj);
    const isManualForce = Boolean(forceEmail || forceSms || forceWhatsapp || skipPreferenceCheck);

    let shouldSendEmail = Boolean(forceEmail || (settings.email_enabled && eventCfg.email));
    let shouldSendSms = Boolean(forceSms || (settings.sms_enabled && eventCfg.sms));
    let shouldSendWhatsapp = Boolean(forceWhatsapp || (settings.whatsapp_enabled && eventCfg.whatsapp));
    const shouldSendPush = Boolean(!isManualForce && settings.push_enabled);

    // Apply strict preference check during automated flows
    if (!isManualForce) {
      if (isWalkIn || pref.preferenceCode === 'not_set') {
        const skipReason = isWalkIn
          ? 'Walk-in customer — auto-messaging skipped'
          : 'Customer has no communication preference set — auto-messaging skipped (Print / manual send only)';
        await recordCommunicationLog({
          storeId: effectiveStoreId,
          orderId: orderObj ? orderObj.id : (orderId || null),
          orderCode: orderObj ? orderObj.order_id : null,
          customerId: customerObj ? customerObj.id : (customerId || null),
          customerName: customerObj ? customerObj.name : 'Walk-in Customer',
          preferenceId: pref.preferenceId,
          preferenceCode: pref.preferenceCode,
          eventKey,
          channel: 'none',
          dispatchMode,
          status: 'skipped',
          provider: 'none',
          errorMessage: skipReason,
          triggeredBy,
          sourcePage
        });
        return {
          sentEmail: false,
          sentSms: false,
          sentWhatsapp: false,
          sentPush: false,
          skipped: true,
          preference: pref,
          reason: isWalkIn ? 'walk_in' : 'not_set',
          message: skipReason
        };
      }

      if (pref.preferenceCode === 'print') {
        const skipReason = 'Customer communication preference is Print (paper receipt only)';
        await recordCommunicationLog({
          storeId: effectiveStoreId,
          orderId: orderObj ? orderObj.id : (orderId || null),
          orderCode: orderObj ? orderObj.order_id : null,
          customerId: customerObj ? customerObj.id : (customerId || null),
          customerName: customerObj ? customerObj.name : 'Customer',
          preferenceId: pref.preferenceId,
          preferenceCode: pref.preferenceCode,
          eventKey,
          channel: 'print',
          dispatchMode,
          status: 'skipped',
          provider: 'none',
          errorMessage: skipReason,
          triggeredBy,
          sourcePage
        });
        return {
          sentEmail: false,
          sentSms: false,
          sentWhatsapp: false,
          sentPush: false,
          skipped: true,
          preference: pref,
          reason: 'print_preference',
          message: skipReason
        };
      }

      if (pref.preferenceCode === 'email') {
        shouldSendEmail = Boolean(settings.email_enabled && eventCfg.email);
        shouldSendSms = false;
        shouldSendWhatsapp = false;
        if (!shouldSendEmail) {
          const skipReason = !settings.email_enabled
            ? 'Email delivery is disabled in Notification Settings'
            : `Email is turned off for event '${eventKey}' in Notification Settings`;
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : 'Customer',
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'email',
            dispatchMode,
            recipient: customerObj ? customerObj.email : null,
            status: 'skipped',
            provider: 'smtp',
            errorMessage: skipReason,
            triggeredBy,
            sourcePage
          });
          return { sentEmail: false, sentSms: false, sentWhatsapp: false, sentPush: false, skipped: true, preference: pref, reason: 'channel_disabled', message: skipReason };
        }
      } else if (pref.preferenceCode === 'sms') {
        shouldSendSms = Boolean(settings.sms_enabled && eventCfg.sms);
        shouldSendEmail = false;
        shouldSendWhatsapp = false;
        if (!shouldSendSms) {
          const skipReason = !settings.sms_enabled
            ? 'SMS delivery is disabled in Notification Settings'
            : `SMS is turned off for event '${eventKey}' in Notification Settings`;
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : 'Customer',
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'sms',
            dispatchMode,
            recipient: customerObj ? customerObj.number : null,
            status: 'skipped',
            provider: 'twilio',
            errorMessage: skipReason,
            triggeredBy,
            sourcePage
          });
          return { sentEmail: false, sentSms: false, sentWhatsapp: false, sentPush: false, skipped: true, preference: pref, reason: 'channel_disabled', message: skipReason };
        }
      } else if (pref.preferenceCode === 'chat') {
        shouldSendWhatsapp = Boolean(settings.whatsapp_enabled && eventCfg.whatsapp);
        shouldSendEmail = false;
        shouldSendSms = false;
        if (!shouldSendWhatsapp) {
          const skipReason = !settings.whatsapp_enabled
            ? 'WhatsApp delivery is disabled in Notification Settings'
            : `WhatsApp is turned off for event '${eventKey}' in Notification Settings`;
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : 'Customer',
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'whatsapp',
            dispatchMode,
            recipient: customerObj ? customerObj.number : null,
            status: 'skipped',
            provider: 'openwa',
            errorMessage: skipReason,
            triggeredBy,
            sourcePage
          });
          return { sentEmail: false, sentSms: false, sentWhatsapp: false, sentPush: false, skipped: true, preference: pref, reason: 'channel_disabled', message: skipReason };
        }
      }
    }

    if (!shouldSendEmail && !shouldSendSms && !shouldSendWhatsapp && !shouldSendPush) {
      return { sentEmail: false, sentSms: false, sentWhatsapp: false, sentPush: false, skipped: true, preference: pref };
    }

    const storeRows = effectiveStoreId > 0
      ? await DataFind(`SELECT * FROM tbl_store WHERE id = '${effectiveStoreId}' LIMIT 1`)
      : [];
    const storeObj = storeRows && storeRows.length > 0 ? storeRows[0] : {};

    const masterRows = await DataFind(`SELECT * FROM tbl_master_shop LIMIT 1`);
    const masterObj = masterRows && masterRows.length > 0 ? masterRows[0] : (accessdata?.masterstore || {});

    const { subject, htmlBody, smsBody, whatsappBody } = buildNotificationContent({
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
    let sentWhatsapp = false;
    let sentPush = false;
    let whatsappError = null;
    let whatsappMessageId = null;

    // 1. Send Email if enabled/forced and recipient email is available
    const targetEmail = (overrideRecipient && forceEmail)
      ? String(overrideRecipient).trim()
      : ((!isWalkIn && customerObj && customerObj.email) ? String(customerObj.email).trim() : "");

    if (shouldSendEmail) {
      if (targetEmail !== "") {
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
            await recordCommunicationLog({
              storeId: effectiveStoreId,
              orderId: orderObj ? orderObj.id : (orderId || null),
              orderCode: orderObj ? orderObj.order_id : null,
              customerId: customerObj ? customerObj.id : (customerId || null),
              customerName: customerObj ? customerObj.name : null,
              preferenceId: pref.preferenceId,
              preferenceCode: pref.preferenceCode,
              eventKey,
              channel: 'email',
              dispatchMode: isManualForce ? 'manual' : dispatchMode,
              recipient: targetEmail,
              subject,
              messagePreview: smsBody || subject,
              status: 'sent',
              provider: 'smtp',
              triggeredBy,
              sourcePage
            });
          } catch (emailErr) {
            console.error(`[NotificationService] Email error (${eventKey}):`, emailErr.message);
            await recordCommunicationLog({
              storeId: effectiveStoreId,
              orderId: orderObj ? orderObj.id : (orderId || null),
              orderCode: orderObj ? orderObj.order_id : null,
              customerId: customerObj ? customerObj.id : (customerId || null),
              customerName: customerObj ? customerObj.name : null,
              preferenceId: pref.preferenceId,
              preferenceCode: pref.preferenceCode,
              eventKey,
              channel: 'email',
              dispatchMode: isManualForce ? 'manual' : dispatchMode,
              recipient: targetEmail,
              subject,
              status: 'failed',
              provider: 'smtp',
              errorMessage: emailErr.message,
              triggeredBy,
              sourcePage
            });
            if (forceEmail) throw emailErr;
          }
        } else {
          const cfgErr = "SMTP mail server is not configured yet. Please configure Mail Settings first.";
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : null,
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'email',
            dispatchMode: isManualForce ? 'manual' : dispatchMode,
            recipient: targetEmail,
            subject,
            status: 'failed',
            provider: 'smtp',
            errorMessage: cfgErr,
            triggeredBy,
            sourcePage
          });
          if (forceEmail) throw new Error(cfgErr);
        }
      } else {
        const missErr = "Customer email address is missing or empty.";
        await recordCommunicationLog({
          storeId: effectiveStoreId,
          orderId: orderObj ? orderObj.id : (orderId || null),
          orderCode: orderObj ? orderObj.order_id : null,
          customerId: customerObj ? customerObj.id : (customerId || null),
          customerName: customerObj ? customerObj.name : null,
          preferenceId: pref.preferenceId,
          preferenceCode: pref.preferenceCode,
          eventKey,
          channel: 'email',
          dispatchMode: isManualForce ? 'manual' : dispatchMode,
          status: 'failed',
          provider: 'smtp',
          errorMessage: missErr,
          triggeredBy,
          sourcePage
        });
        if (forceEmail) throw new Error(missErr);
      }
    }

    // 2. Send SMS if enabled/forced and recipient phone is available
    const targetPhone = (overrideRecipient && (forceSms || forceWhatsapp))
      ? String(overrideRecipient).trim()
      : ((!isWalkIn && customerObj && customerObj.number) ? String(customerObj.number).trim() : "");

    if (shouldSendSms) {
      if (targetPhone !== "") {
        const twilioCfg = await resolveTwilioConfig(storeObj, masterObj);
        const formattedTo = formatE164Phone(targetPhone);
        if (twilioCfg.isConfigured && formattedTo) {
          try {
            const clientSms = require("twilio")(twilioCfg.sid, twilioCfg.token);
            const twilioRes = await clientSms.messages.create({
              body: smsBody,
              from: twilioCfg.fromPhone,
              to: formattedTo
            });
            sentSms = true;
            await recordCommunicationLog({
              storeId: effectiveStoreId,
              orderId: orderObj ? orderObj.id : (orderId || null),
              orderCode: orderObj ? orderObj.order_id : null,
              customerId: customerObj ? customerObj.id : (customerId || null),
              customerName: customerObj ? customerObj.name : null,
              preferenceId: pref.preferenceId,
              preferenceCode: pref.preferenceCode,
              eventKey,
              channel: 'sms',
              dispatchMode: isManualForce ? 'manual' : dispatchMode,
              recipient: formattedTo,
              messagePreview: smsBody,
              status: 'sent',
              provider: 'twilio',
              providerMessageId: (twilioRes && twilioRes.sid) || null,
              triggeredBy,
              sourcePage
            });
          } catch (twilioErr) {
            console.error(`[NotificationService] Twilio error (${eventKey}):`, twilioErr.message);
            await recordCommunicationLog({
              storeId: effectiveStoreId,
              orderId: orderObj ? orderObj.id : (orderId || null),
              orderCode: orderObj ? orderObj.order_id : null,
              customerId: customerObj ? customerObj.id : (customerId || null),
              customerName: customerObj ? customerObj.name : null,
              preferenceId: pref.preferenceId,
              preferenceCode: pref.preferenceCode,
              eventKey,
              channel: 'sms',
              dispatchMode: isManualForce ? 'manual' : dispatchMode,
              recipient: targetPhone,
              messagePreview: smsBody,
              status: 'failed',
              provider: 'twilio',
              errorMessage: twilioErr.message,
              triggeredBy,
              sourcePage
            });
            if (forceSms) throw twilioErr;
          }
        } else {
          const cfgErr = !formattedTo ? "Invalid recipient phone number format." : "Twilio SMS is not configured yet. Please configure Twilio Settings first.";
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : null,
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'sms',
            dispatchMode: isManualForce ? 'manual' : dispatchMode,
            recipient: targetPhone,
            messagePreview: smsBody,
            status: 'failed',
            provider: 'twilio',
            errorMessage: cfgErr,
            triggeredBy,
            sourcePage
          });
          if (forceSms) throw new Error(cfgErr);
        }
      } else {
        const missErr = "Customer phone number is missing or empty.";
        await recordCommunicationLog({
          storeId: effectiveStoreId,
          orderId: orderObj ? orderObj.id : (orderId || null),
          orderCode: orderObj ? orderObj.order_id : null,
          customerId: customerObj ? customerObj.id : (customerId || null),
          customerName: customerObj ? customerObj.name : null,
          preferenceId: pref.preferenceId,
          preferenceCode: pref.preferenceCode,
          eventKey,
          channel: 'sms',
          dispatchMode: isManualForce ? 'manual' : dispatchMode,
          status: 'failed',
          provider: 'twilio',
          errorMessage: missErr,
          triggeredBy,
          sourcePage
        });
        if (forceSms) throw new Error(missErr);
      }
    }

    // 3. Send WhatsApp via Open-WA if enabled/forced and recipient phone is available
    const targetWaPhone = (overrideRecipient && forceWhatsapp)
      ? String(overrideRecipient).trim()
      : ((!isWalkIn && customerObj && customerObj.number) ? String(customerObj.number).trim() : "");

    if (shouldSendWhatsapp) {
      if (targetWaPhone !== "") {
        const waText = (customMessage && String(customMessage).trim() !== "")
          ? String(customMessage).trim()
          : (extraData && extraData.whatsappText ? String(extraData.whatsappText).trim() : whatsappBody);

        const waRes = await sendOpenWaTextMessage({
          storeId: effectiveStoreId,
          storeObj,
          masterObj,
          recipientPhone: targetWaPhone,
          text: waText
        });

        if (waRes && waRes.success) {
          sentWhatsapp = true;
          whatsappMessageId = waRes.messageId || null;
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : null,
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'whatsapp',
            dispatchMode: isManualForce ? 'manual' : dispatchMode,
            recipient: targetWaPhone,
            messagePreview: waText,
            status: 'sent',
            provider: 'openwa',
            providerMessageId: waRes.messageId || null,
            triggeredBy,
            sourcePage
          });
        } else {
          whatsappError = (waRes && waRes.message) || "Open-WA dispatch failed.";
          if (waRes && !waRes.notConfigured && !waRes.paused) {
            console.warn(`[NotificationService] Open-WA notice (${eventKey}):`, whatsappError);
          }
          await recordCommunicationLog({
            storeId: effectiveStoreId,
            orderId: orderObj ? orderObj.id : (orderId || null),
            orderCode: orderObj ? orderObj.order_id : null,
            customerId: customerObj ? customerObj.id : (customerId || null),
            customerName: customerObj ? customerObj.name : null,
            preferenceId: pref.preferenceId,
            preferenceCode: pref.preferenceCode,
            eventKey,
            channel: 'whatsapp',
            dispatchMode: isManualForce ? 'manual' : dispatchMode,
            recipient: targetWaPhone,
            messagePreview: waText,
            status: 'failed',
            provider: 'openwa',
            errorMessage: whatsappError,
            triggeredBy,
            sourcePage
          });
          if (forceWhatsapp) {
            throw new Error(whatsappError);
          }
        }
      } else {
        const missErr = "Customer phone number is missing or empty.";
        await recordCommunicationLog({
          storeId: effectiveStoreId,
          orderId: orderObj ? orderObj.id : (orderId || null),
          orderCode: orderObj ? orderObj.order_id : null,
          customerId: customerObj ? customerObj.id : (customerId || null),
          customerName: customerObj ? customerObj.name : null,
          preferenceId: pref.preferenceId,
          preferenceCode: pref.preferenceCode,
          eventKey,
          channel: 'whatsapp',
          dispatchMode: isManualForce ? 'manual' : dispatchMode,
          status: 'failed',
          provider: 'openwa',
          errorMessage: missErr,
          triggeredBy,
          sourcePage
        });
        if (forceWhatsapp) throw new Error(missErr);
      }
    }

    // 4. Send Push Notification via OneSignal if enabled
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

    return {
      sentEmail,
      sentSms,
      sentWhatsapp,
      sentPush,
      whatsappMessageId,
      whatsappError,
      preference: pref,
      customerName: customerObj ? customerObj.name : null,
      orderId: orderObj ? orderObj.id : (orderId || null),
      orderCode: orderObj ? orderObj.order_id : null
    };
  } catch (err) {
    console.error(`[NotificationService] Error dispatching ${eventKey}:`, err);
    return { sentEmail: false, sentSms: false, sentWhatsapp: false, sentPush: false, error: err.message };
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
  } else if (channel === "whatsapp") {
    const waCfg = await resolveOpenWaConfig(storeObj, masterObj);
    if (!waCfg.baseUrl || !waCfg.apiKey || !waCfg.sessionId) {
      return {
        success: false,
        message: "Open-WA Gateway (Base URL, API Key, Session Name/ID) is not configured yet."
      };
    }

    const res = await sendOpenWaTextMessage({
      storeId: effectiveStoreId,
      storeObj,
      masterObj,
      recipientPhone: cleanRecipient,
      text: `✅ *${storeName}* — Test WhatsApp Message Successful!\nYour automated Open-WA customer notifications are connected and active.\n⏰ Sent: ${new Date().toLocaleString()}`
    });

    if (res && res.success) {
      return {
        success: true,
        messageId: res.messageId,
        chatId: res.chatId,
        message: `Test WhatsApp sent via Open-WA session '${res.sessionName}' to ${res.chatId}!`
      };
    }
    return {
      success: false,
      sessionNotReady: Boolean(res?.sessionNotReady),
      sessionStatus: res?.sessionStatus || null,
      message: (res && res.message) || "Failed to send test WhatsApp message via Open-WA."
    };
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

function formatWhatsAppNumber(phone, defaultCountryCode = "1") {
  const jid = formatOpenWaChatId(phone, defaultCountryCode);
  if (jid && jid.includes("@")) {
    return jid.split("@")[0];
  }
  if (!phone) return "";
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  const cleanCC = String(defaultCountryCode || "1").replace(/\D/g, "") || "1";
  if (digits.length === 10) return `${cleanCC}${digits}`;
  return digits;
}

/**
 * Control Open-WA session lifecycle (start | stop | logout | create) from Settings UI
 */
async function controlOpenWaSession({ storeId = 0, action = "start", baseUrl, apiKey, sessionId } = {}) {
  const resolved = await resolveOpenWaConfig(storeId);
  const cfg = {
    baseUrl: (baseUrl !== undefined && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : resolved.baseUrl,
    apiKey: (apiKey !== undefined && String(apiKey).trim() !== "") ? String(apiKey).trim() : resolved.apiKey,
    sessionId: (sessionId !== undefined && String(sessionId).trim() !== "") ? String(sessionId).trim() : resolved.sessionId,
    defaultCountryCode: resolved.defaultCountryCode,
    status: "1"
  };

  if (!cfg.baseUrl || !cfg.apiKey || !cfg.sessionId) {
    return { success: false, message: "Open-WA Base URL, API Key, and Session Name/ID are required." };
  }

  openWaSessionUuidCache.clear();
  const cleanAction = String(action || "start").toLowerCase().trim();

  if (cleanAction === "create") {
    return await getOpenWaSessionStatusAndQr({
      storeId,
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      sessionId: cfg.sessionId,
      autoStart: true,
      createIfMissing: true
    });
  }

  let session = await resolveOpenWaSession(cfg, true);
  if (!session || !session.id) {
    if (cleanAction === "start") {
      return await getOpenWaSessionStatusAndQr({
        storeId,
        baseUrl: cfg.baseUrl,
        apiKey: cfg.apiKey,
        sessionId: cfg.sessionId,
        autoStart: true,
        createIfMissing: true
      });
    }
    return { success: false, message: `Session '${cfg.sessionId}' not found on Open-WA server.` };
  }

  if (cleanAction === "start") {
    if (!session.engineLoaded) {
      await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/start`, {
        method: "POST",
        timeoutMs: 15000
      });
    }
  } else if (cleanAction === "stop") {
    await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/stop`, {
      method: "POST",
      timeoutMs: 12000
    });
  } else if (cleanAction === "logout") {
    await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/logout`, {
      method: "POST",
      timeoutMs: 12000
    });
  } else if (cleanAction === "restart") {
    try {
      await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/stop`, {
        method: "POST",
        timeoutMs: 10000
      });
    } catch (_) {
      // ignore if already stopped
    }
    await openWaRequest(cfg, `/api/sessions/${encodeURIComponent(session.id)}/start`, {
      method: "POST",
      timeoutMs: 15000
    });
  } else {
    return { success: false, message: `Unsupported Open-WA session action '${cleanAction}'.` };
  }

  return await getOpenWaSessionStatusAndQr({
    storeId,
    baseUrl: cfg.baseUrl,
    apiKey: cfg.apiKey,
    sessionId: session.id,
    autoStart: false,
    createIfMissing: false
  });
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
  resolveOpenWaConfig,
  formatOpenWaChatId,
  listOpenWaSessions,
  resolveOpenWaSession,
  getOpenWaSessionStatusAndQr,
  controlOpenWaSession,
  sendOpenWaTextMessage,
  formatWhatsAppInvoiceMessage,
  formatWhatsAppPickupAcceptedMessage,
  formatWhatsAppNumber,
  isRouteDeliveryOrderType,
  isRoutePickupOrderType,
  ensureCommunicationLogsTable,
  recordCommunicationLog,
  hasOrderChannelAlreadySent,
  getOrderCommunicationLogs,
  getCustomerCommunicationLogs,
  resolveCustomerCommunicationPreference
};

