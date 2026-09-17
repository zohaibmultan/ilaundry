# Rule: Thermal Printing & Silent Print Failover

## Purpose
Ensures thermal receipt and tag printing never fails silently or blocks users when hardware services or network connections are disrupted.

## Invariant Rules
1. **Always Implement Dual-Mode Printing**:
   - Primary: Silent background printing to local print service (`http://127.0.0.1:4321`) via `POSPrintClient`.
   - Fallback: Chrome native print dialog (`window.print()`).
2. **Immediate Failover on Offline or Error**:
   - Check printing server availability with a fast timeout (3–4 seconds).
   - If server is unreachable or `posClient.printHTML(...)` returns an error / throws, immediately fall back to `window.print()`.
   - Never display a blocking error popup that leaves the user unable to print.
3. **Cloth Tag Print Isolation**:
   - Use a body CSS class (e.g., `body.printing-tags`) to toggle printing between the receipt (`.receipt-container`) and garment tags (`.cloth-tag-container`).
   - Clean up the `printing-tags` class using `window.addEventListener("afterprint", ...)` and a fallback timer (`setTimeout(..., 2000)`).
4. **Barcode Compatibility**:
   - Cloth tags must generate Code128 barcodes using `JsBarcode` with high contrast and legible dimensions (e.g. `width: 1.4, height: 34`).
