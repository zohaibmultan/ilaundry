/**
 * Helper script to verify the connectivity and health of the local POS printing server.
 * Usage: node .agents/skills/pos-printing/scripts/check-print-server.js [port]
 */

const http = require("http");

const port = process.argv[2] || 4321;
const host = "127.0.0.1";

console.log(`[POS Print Check] Pinging printing server at http://${host}:${port}/health ...`);

const req = http.get(
  {
    hostname: host,
    port: port,
    path: "/health",
    timeout: 3000,
  },
  (res) => {
    let raw = "";
    res.on("data", (chunk) => (raw += chunk));
    res.on("end", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log(`✅ POS Printing Server is ONLINE (HTTP ${res.statusCode})`);
        try {
          const parsed = JSON.parse(raw);
          console.log("Server Info:", JSON.stringify(parsed, null, 2));
        } catch (_) {
          console.log("Server Response:", raw);
        }
      } else {
        console.log(`⚠️ POS Printing Server returned non-200 status: HTTP ${res.statusCode}`);
      }
    });
  }
);

req.on("timeout", () => {
  req.destroy();
  console.log(`❌ Timeout: No response from http://${host}:${port} within 3000ms. (Printing server likely offline)`);
});

req.on("error", (err) => {
  console.log(`❌ Error connecting to http://${host}:${port} - ${err.message}`);
  console.log("ℹ️  Native browser print (window.print) fallback will be used in POS print page.");
});
