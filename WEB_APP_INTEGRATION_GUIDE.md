# Web Application Integration Guide — POS Silent Printing Server

This guide explains how to connect any web application (Vanilla JS, React, Vue, Angular, or Node.js/EJS like iLaundry) to the **POS Printing Server** to print receipts, kitchen slips, barcodes, and tags silently without the browser print dialog (`Ctrl+P`).

---

## 1. Architecture Overview

```
┌────────────────────────────────────────────────────────┐
│ Cashier's Browser (POS Web App, e.g. http://localhost) │
└──────────────────────────┬─────────────────────────────┘
                           │ HTTP POST (Port 4321)
                           ▼
┌────────────────────────────────────────────────────────┐
│ POS Printing Server (Tray App / Background Service)    │
│  - Endpoint: http://127.0.0.1:4321 (or LAN IP)         │
│  - Spooler Queue: Concurrency 1 (no collision)         │
└──────────────────────────┬─────────────────────────────┘
                           │ Direct Spooler / ESC-POS
                           ▼
┌────────────────────────────────────────────────────────┐
│ Receipt Printer (USB / Network Thermal Printer, etc.)  │
└────────────────────────────────────────────────────────┘
```

The browser sends a standard `POST` request with JSON containing the receipt markup or thermal commands. The printing server receives it, renders or parses it, and feeds it directly into the OS print spooler.

---

## 2. Properties Reference (What Properties You Need)

### Primary Request Schema (`POST /print`)

Endpoint: `http://127.0.0.1:4321/print`  
Headers: `Content-Type: application/json`

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `printerId` | `string` | No | `defaultPrinter` | The printer name or device ID (e.g. `"EPSON TM-T20"`, `"POS-80"`). If omitted or `null`, uses the system/configured default. |
| `contentType` | `string` | **Yes** | — | Format of content. One of: `"html"`, `"escpos"`, `"text"`, `"pdf"`, `"image"`. |
| `content` | `string` \| `array` | **Yes** | — | The actual content to print (HTML string, ESC/POS operation array, plain text, or base64 data). |
| `options` | `object` | No | `{}` | Optional formatting and hardware options (see below). |

---

### `options` Properties

| Property | Type | Default | Description |
|---|---|---|---|
| `options.copies` | `number` | `1` | Number of copies to print. |
| `options.paper.widthMm` | `number` | `80` | Paper roll width in millimeters: `80` (standard 3-inch roll) or `58` (compact 2-inch roll). |
| `options.paper.format` | `string` | `null` | Used for standard sheets instead of rolls: `"A4"`, `"Letter"`, `"Legal"`. |
| `options.paper.margin` | `object` | `0mm` | `{ top: "0mm", bottom: "0mm", left: "0mm", right: "0mm" }`. |
| `options.cut` | `boolean` | `true` | For thermal printers: automatically cut paper after printing. |
| `options.openCashDrawer` | `boolean` | `false` | For thermal printers: trigger the RJ11/RJ12 cash drawer kick pulse. |
| `options.orientation` | `string` | `"portrait"` | Page orientation: `"portrait"` or `"landscape"`. |

---

### `contentType` Options Comparison

| Value | Best Used For | Format of `content` | Notes |
|---|---|---|---|
| `"html"` | Styled receipts, barcodes, laundry tags | Full HTML string or DOM snippet | Rendered via Chromium headless to continuous roll PDF. Exact CSS visual fidelity. |
| `"escpos"` | Fast thermal printing, high volume POS | Array of operation objects | **Fastest (~50ms)**. Directly commands thermal printer pins. No PDF overhead. |
| `"text"` | Plain dot-matrix / raw text logs | Plain text string | Directly queued to printer spooler. |
| `"pdf"` | Pre-generated invoices, reports | Base64-encoded PDF string | Sent directly to the printer driver. |
| `"image"` | Pre-rendered graphics, QR stamps | Base64 PNG or JPEG | Sent directly to the driver. |

---

### ESC/POS Operation Properties (When `contentType: "escpos"`)

When using high-speed thermal printing, `content` is an array of command objects:

| Operation Type (`type`) | Value (`value`) | Example | Purpose |
|---|---|---|---|
| `"align"` | `"left"` \| `"center"` \| `"right"` | `{ type: "align", value: "center" }` | Sets text alignment. |
| `"bold"` | `true` \| `false` | `{ type: "bold", value: true }` | Enables/disables bold text. |
| `"size"` | `"normal"` \| `"double"` \| `"quad"` | `{ type: "size", value: "double" }` | Enlarges font for store title/total. |
| `"text"` | `string` | `{ type: "text", value: "DEMO LAUNDRY" }` | Prints line with automatic newline. |
| `"raw"` | `string` | `{ type: "raw", value: "No newline " }` | Prints inline text without newline. |
| `"line"` | None | `{ type: "line" }` | Draws a horizontal divider line across the roll. |
| `"newline"` | None | `{ type: "newline" }` | Adds an empty line feed. |
| `"table"` | `array` of strings | `{ type: "table", value: ["Shirt Wash x2", "$10.00"] }` | Distributes items into aligned left/right columns. |
| `"barcode"` | `string` | `{ type: "barcode", value: "10023456" }` | Generates hardware thermal barcode. |
| `"qr"` | `string` | `{ type: "qr", value: "https://shop.com/inv/123" }` | Generates hardware thermal QR code. |
| `"cut"` | None | `{ type: "cut" }` | Feeds and cuts paper. |
| `"cashdraw"` | None | `{ type: "cashdraw" }` | Fires cash drawer pulse. |

---

## 3. Web App Integration Methods

### Method 1: Using the Drop-in JavaScript Client (`pos-print-client.js`)

Copy `client/pos-print-client.js` to your web app's public folder (e.g. `public/js/pos-print-client.js`).

```html
<!-- 1. Include script -->
<script src="/js/pos-print-client.js"></script>

<script>
  // Initialize client pointing to local printing server
  const posPrinter = new POSPrintClient({ 
    port: 4321,          // default port
    timeout: 15000       // timeout in ms
  });

  // Example A: Check if server is running
  async function verifyPrinterService() {
    const isOnline = await posPrinter.isAvailable();
    if (!isOnline) {
      console.warn("Printing server is not running in tray! Fallback to window.print()");
    }
    return isOnline;
  }

  // Example B: Populate a printer selection <select id="printerSelect">
  async function initPrinterDropdown() {
    try {
      await posPrinter.populatePrinterSelect("printerSelect");
      // Saves cashier's chosen printer in localStorage automatically!
    } catch (err) {
      console.error("Failed to load printers:", err.message);
    }
  }

  // Example C: Print an existing HTML element on the page
  async function printReceiptElement(elementId) {
    const isReady = await posPrinter.isAvailable();
    if (!isReady) {
      // Fallback to standard browser print
      window.print();
      return;
    }

    // Automatically inlines your web page CSS styles and prints silently!
    const result = await posPrinter.printElement(elementId, {
      widthMm: 80, // 80mm thermal roll
      options: {
        copies: 1,
        cut: true,
        openCashDrawer: false
      }
    });

    if (result.success) {
      alert("Receipt sent to printer!");
    } else {
      alert("Printing failed: " + result.error);
    }
  }

  // Example D: High-Speed ESC/POS Thermal Receipt
  async function printFastReceipt(order) {
    await posPrinter.printReceipt([
      { type: "align", value: "center" },
      { type: "bold", value: true },
      { type: "size", value: "double" },
      { type: "text", value: "iLAUNDRY POS" },
      { type: "size", value: "normal" },
      { type: "bold", value: false },
      { type: "text", value: "Order #: " + order.id },
      { type: "line" },
      { type: "align", value: "left" },
      { type: "table", value: ["Suit Clean x1", "PKR 650"] },
      { type: "table", value: ["Shirt Press x3", "PKR 300"] },
      { type: "line" },
      { type: "bold", value: true },
      { type: "table", value: ["TOTAL", "PKR 950"] },
      { type: "bold", value: false },
      { type: "newline" },
      { type: "align", value: "center" },
      { type: "text", value: "Thank you for your business!" },
      { type: "newline" },
      { type: "cut" }
    ]);
  }
</script>
```

---

### Method 2: Pure `fetch()` (No External Library Required)

You can call the printing server directly using browser standard `fetch()`:

```javascript
async function silentPrint(htmlContent, printerName = null) {
  try {
    const response = await fetch("http://127.0.0.1:4321/print", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        printerId: printerName, // null uses default printer
        contentType: "html",
        content: htmlContent,
        options: {
          paper: { widthMm: 80 },
          copies: 1
        }
      })
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "Printing failed");
    }
    console.log("Printed successfully, Job ID:", data.jobId);
    return true;
  } catch (err) {
    console.error("Local printing server unavailable:", err.message);
    // Fallback to standard window.print()
    window.print();
    return false;
  }
}
```

---

## 4. Specific Integration Guide for this Project (`iLaundry` POS)

In this project, receipts are generated in `views/posprint.ejs` and triggered from `views/pos.ejs`.

### Upgrading `views/posprint.ejs` (Zero-Click Silent Print)

Currently `posprint.ejs` runs:
```javascript
window.onload = function () {
  window.print(); // Forces browser print popup
};
window.onafterprint = function () {
  window.location.href = '/admin/pos';
};
```

**Upgrade to silent printing with automatic fallback:**

```html
<!-- Inside views/posprint.ejs -->
<script src="/public/js/pos-print-client.js"></script>
<script>
  window.onload = async function () {
    const client = new POSPrintClient({ port: 4321, timeout: 5000 });
    
    // Check if printing server is active
    const isServerOnline = await client.isAvailable();
    
    if (isServerOnline) {
      try {
        // Send the receipt container silently
        const receiptHtml = document.querySelector('.receipt-container').outerHTML;
        const res = await client.printHTML(
          `<!DOCTYPE html><html><head><style>${document.querySelector('style').innerHTML}</style></head><body>${receiptHtml}</body></html>`,
          { widthMm: 80 }
        );
        
        if (res.success) {
          // Finished silently, redirect back immediately
          window.location.href = '/admin/pos';
          return;
        }
      } catch (e) {
        console.warn("Silent print error, falling back to browser print:", e);
      }
    }

    // Fallback: If printing server not running on this PC, use standard print dialog
    window.print();
    window.onafterprint = function () {
      window.location.href = '/admin/pos';
    };
  };
</script>
```

---

### Adding a Printer Selector in POS Settings (`views/master_settings.ejs`)

To allow the store manager to pick a specific receipt printer:

```html
<div class="mb-3">
  <label class="form-label fw-bold">Select POS Thermal Receipt Printer</label>
  <select id="posReceiptPrinter" class="form-select">
    <option value="">Detecting local printers...</option>
  </select>
  <small class="text-muted">Detected via local POS Printing Server.</small>
</div>

<script src="/public/js/pos-print-client.js"></script>
<script>
  document.addEventListener("DOMContentLoaded", async () => {
    const client = new POSPrintClient({ port: 4321 });
    if (await client.isAvailable()) {
      await client.populatePrinterSelect("posReceiptPrinter");
    } else {
      document.getElementById("posReceiptPrinter").innerHTML = 
        '<option value="">Printing Server offline (install / start tray app)</option>';
    }
  });
</script>
```

---

## 5. Network, HTTPS & Security Considerations

### 1. HTTPS and Mixed Content
- **Localhost Exception**: If your POS web app runs on `https://my-laundry.com` and communicates with `http://127.0.0.1:4321`, modern browsers (Chrome, Edge) treat `127.0.0.1` and `localhost` as **Secure Contexts**, so requests are allowed.
- **LAN Multi-terminal (e.g. `http://192.168.1.50:4321`)**: If other terminals connect across the LAN to a central printer PC, run your web app over HTTP on the local network, or access the printer PC's IP directly.

### 2. CORS Whitelisting
By default, `config.json` allows `["*"]` or `localhost`. If your POS runs on a specific domain (e.g. `http://pos.local` or `http://localhost:5000`), verify it is included in `allowedOrigins` in `config.json`:
```json
{
  "allowedOrigins": ["*"]
}
```

### 3. Windows Firewall
Ensure port 4321 is allowed on the printer machine:
- Run `scripts/setup-firewall.bat` as Administrator on the machine connected to the printer.

---

## 6. Quick Testing & Debugging Checklist

| Check | Action | Expected Result |
|---|---|---|
| Server Running | `GET http://127.0.0.1:4321/health` | `{"status": "running"}` |
| List Printers | `GET http://127.0.0.1:4321/printers` | `{"success": true, "printers": [...]}` |
| Test Printer Health | `GET http://127.0.0.1:4321/printers/<name>/status` | `{"success": true, "online": true}` |
| View Recent Logs | `GET http://127.0.0.1:4321/logs` | Returns last 100 log entries |
| Interactive Test Page | Open `client/test-page.html` in browser | Green connection dot and 1-click test receipt print |
