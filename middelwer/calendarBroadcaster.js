/**
 * Real-Time Calendar Event Broadcaster (Server-Sent Events)
 * Provides sub-second real-time calendar updates across all connected browsers
 * without external websocket libraries or heavy infrastructure.
 */

let clients = [];

// Send keep-alive comment every 25 seconds to keep HTTP connections alive through proxies
const keepAliveInterval = setInterval(() => {
  if (clients.length === 0) return;
  clients.forEach((client) => {
    try {
      client.res.write(": keepalive\n\n");
    } catch (err) {
      // Socket dead, will be pruned
    }
  });
}, 25000);

if (keepAliveInterval.unref) {
  keepAliveInterval.unref();
}

/**
 * Register a new browser client for real-time calendar updates
 * @param {express.Request} req 
 * @param {express.Response} res 
 */
function addClient(req, res) {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }

  // Initial handshake
  res.write(`data: ${JSON.stringify({ type: "connected", timestamp: new Date().toISOString() })}\n\n`);

  const clientRecord = {
    res,
    userId: req.user ? req.user.id : null,
    storeId: req.user ? (req.user.store || req.user.store_ID) : null,
  };

  clients.push(clientRecord);

  req.on("close", () => {
    clients = clients.filter((c) => c.res !== res);
  });
}

/**
 * Broadcast an event mutation to all active calendar browser tabs
 * @param {Object} eventData e.g. { action: 'status_changed'|'order_created'|'order_updated'|'order_deleted', order_id: ..., ... }
 */
function broadcastCalendarChange(eventData) {
  if (!clients.length) return;

  const payload = `data: ${JSON.stringify({
    ...eventData,
    broadcastAt: new Date().toISOString(),
  })}\n\n`;

  clients.forEach((client) => {
    try {
      client.res.write(payload);
    } catch (e) {
      // Drop failed connection
      clients = clients.filter((c) => c !== client);
    }
  });
}

module.exports = {
  addClient,
  broadcastCalendarChange,
};
