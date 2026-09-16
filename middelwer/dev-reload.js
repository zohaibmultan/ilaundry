const fs = require("fs");
const path = require("path");

let clients = [];

function setupDevReload(app) {
  // SSE endpoint for live reload
  app.get("/dev-reload-stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    if (typeof res.flushHeaders === "function") res.flushHeaders();

    res.write("data: connected\n\n");
    clients.push(res);

    req.on("close", () => {
      clients = clients.filter((c) => c !== res);
    });
  });

  // HEAD endpoint for polling server reboot
  app.head("/dev-reload-stream", (req, res) => {
    res.status(200).end();
  });

  let debounceTimer = null;
  function broadcast(event) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const payload = `data: ${event}\n\n`;
      clients.forEach((client) => {
        try {
          client.write(payload);
        } catch (e) {}
      });
    }, 120);
  }

  // Watch public/css for hot CSS reloads
  const cssDir = path.join(__dirname, "..", "public", "css");
  if (fs.existsSync(cssDir)) {
    try {
      fs.watch(cssDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith(".css")) {
          broadcast("reload-css");
        }
      });
    } catch (err) {
      console.warn("[DevReload] Watcher warning on css:", err.message);
    }
  }

  // Watch views for template reloads
  const viewsDir = path.join(__dirname, "..", "views");
  if (fs.existsSync(viewsDir)) {
    try {
      fs.watch(viewsDir, { recursive: true }, (eventType, filename) => {
        if (filename && filename.endsWith(".ejs")) {
          broadcast("reload-page");
        }
      });
    } catch (err) {
      console.warn("[DevReload] Watcher warning on views:", err.message);
    }
  }

  console.log("⚡ [DevReload] Live-reload active for CSS hot-updates & EJS templates.");
}

module.exports = { setupDevReload };
