---
name: pos-printing
description: >-
  Thermal receipt and garment cloth tag printing workflow for iCleaners.
  Covers the local printing server (port 4321), POSPrintClient API, silent printing,
  Code128 barcode generation via JsBarcode, and native Chrome print fallback.
---

# POS Printing Workflow & Runbook

This skill provides step-by-step guidance for maintaining and extending thermal invoice and cloth tag printing in iCleaners.

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

## Combined Thermal Print & Auto-Cutter Pattern

When printing both invoice receipt and cloth tags in a single click from the same thermal printer, follow this sequential execution pattern:

```javascript
/**
 * Combined Print: Prints Invoice and all Cloth Tags sequentially on the SAME printer
 * with physical paper cut triggered after invoice and after EACH tag.
 */
async function printAllCombined() {
  if (silentEnabled && isServerOnline) {
    const targetPrinter = invoicePrinter || null;
    const targetWidth = invoiceWidthMm || 80;

    // 1. Send Invoice with Cut & Cash Drawer Kick
    await posClient.printHTML(invoiceHtml, {
      printerId: targetPrinter,
      widthMm: targetWidth,
      options: { copies: copies, cut: true, openCashDrawer: openDrawer }
    });

    // 2. Send each Cloth Tag sequentially with Cut
    const tags = container.querySelectorAll(".cloth-tag");
    for (let i = 0; i < tags.length; i++) {
      await posClient.printHTML(tags[i].outerHTML, {
        printerId: targetPrinter,
        widthMm: targetWidth,
        options: { copies: 1, cut: true }
      });
    }
    return;
  }

  // Native Chrome Print Fallback
  switchPrintMode("all");
  window.print();
}
```

## Multi-Piece Garment Tag Multiplier

When generating garment cloth wash tags, multiply the intake quantity by the item's physical piece count (`no_of_items`):

```javascript
let totalPieces = 0;
cartServices.forEach(item => {
  const qty = parseInt(item.service_quntity, 10) || 1;
  const pieces = parseInt(item.no_of_items, 10) || 1;
  totalPieces += (qty * pieces);
});
// Generates qty * pieces tags, numbered Piece 1/totalPieces ... Piece N/totalPieces
```

## Helper Scripts
- Check print server status:
  `node .agents/skills/pos-printing/scripts/check-print-server.js`

## References
- See detailed protocol reference in [pos-print-api.md](./references/pos-print-api.md).

