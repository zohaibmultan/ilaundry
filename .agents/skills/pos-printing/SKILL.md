---
name: pos-printing
description: >-
  Thermal receipt and garment cloth tag printing workflow for iLaundry.
  Covers the local printing server (port 4321), POSPrintClient API, silent printing,
  Code128 barcode generation via JsBarcode, and native Chrome print fallback.
---

# POS Printing Workflow & Runbook

This skill provides step-by-step guidance for maintaining and extending thermal invoice and cloth tag printing in iLaundry.

## Architecture

1. **Printing Client Library**: Located at `public/js/pos-print-client.js`.
   ```javascript
   const posClient = new POSPrintClient({ baseUrl: serverUrl, timeout: 4000 });
   ```
2. **Local Printing Server**:
   - Default URL: `http://127.0.0.1:4321`.
   - Checks endpoint: `GET /health`.
   - Print endpoint: `POST /print/html` with payload `{ html, printerId, widthMm, options }`.
3. **Printer Formats & Dimensions**:
   - Invoice 80mm: Standard 3-inch thermal roll (`widthMm: 80`).
   - Invoice 58mm: Standard 2-inch thermal roll (`widthMm: 58`).
   - Cloth Tags: 75mm or 50mm wash-resistant tags (`widthMm: 75` or `50`).
4. **Barcode Generation**:
   - JsBarcode generates SVG barcodes (`CODE128`) into tag elements:
     ```javascript
     JsBarcode("#svg_id", "ORDER-ID", { format: "CODE128", width: 1.4, height: 34, displayValue: true });
     ```

## Dual-Mode Execution Pattern

```javascript
async function printInvoice() {
  try {
    if (silentEnabled && isServerOnline) {
      const res = await posClient.printHTML(fullHtml, {
        printerId: invoicePrinter || null,
        widthMm: invoiceWidthMm || 80,
        options: { copies: 1, cut: true, openCashDrawer: false }
      });
      if (res && res.success) {
        showNotification("Invoice printed successfully", "success");
        return;
      }
    }
    // Native fallback
    document.body.classList.remove("printing-tags");
    window.print();
  } catch (err) {
    document.body.classList.remove("printing-tags");
    window.print();
  }
}
```

## Helper Scripts
- Check print server status:
  `node .agents/skills/pos-printing/scripts/check-print-server.js`

## References
- See detailed protocol reference in [pos-print-api.md](./references/pos-print-api.md).
