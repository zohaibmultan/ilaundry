/**
 * pos-print-client.js
 *
 * Drop this into your POS website. It talks to the local printing server
 * so a "Print" button sends the receipt straight to the printer with no
 * Chrome print dialog.
 *
 *   <script src="pos-print-client.js"></script>
 *   <script>
 *     const printer = new POSPrintClient({ port: 4321 });
 *     await printer.printHTML(document.getElementById('receipt').outerHTML);
 *   </script>
 */
(function (global) {
  class POSPrintClient {
    constructor(options = {}) {
      this.baseUrl = options.baseUrl || `http://127.0.0.1:${options.port || 4321}`;
      this.defaultPrinter = options.defaultPrinter || this.loadSavedPrinter();
      this.timeout = options.timeout || 30000;
    }

    // ---------- storage of the operator's chosen printer ----------

    loadSavedPrinter() {
      try {
        return window.localStorage.getItem("pos_selected_printer") || null;
      } catch (e) {
        return null;
      }
    }

    setDefaultPrinter(printerId) {
      this.defaultPrinter = printerId;
      try {
        window.localStorage.setItem("pos_selected_printer", printerId);
      } catch (e) {
        /* storage unavailable, keep in memory only */
      }
    }

    // ---------- low level ----------

    async request(path, options = {}) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const res = await fetch(this.baseUrl + path, {
          ...options,
          signal: controller.signal,
          headers: { "Content-Type": "application/json", ...(options.headers || {}) }
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
        return data;
      } catch (err) {
        if (err.name === "AbortError") throw new Error("Printing server did not respond in time");
        if (err instanceof TypeError) {
          throw new Error(
            "Printing server is not reachable. Make sure the tray app is running."
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
      }
    }

    // ---------- public API ----------

    /** Returns true if the local printing server is up. */
    async isAvailable() {
      try {
        const data = await this.request("/health");
        return data.status === "running";
      } catch (e) {
        return false;
      }
    }

    /** [{ name, deviceId, isDefault }] */
    async getPrinters() {
      const data = await this.request("/printers");
      return data.printers;
    }

    async getPrinterStatus(printerId) {
      return this.request(`/printers/${encodeURIComponent(printerId)}/status`);
    }

    /** Core print call. */
    async print(contentType, content, opts = {}) {
      const printerId = opts.printerId || this.defaultPrinter;
      return this.request("/print", {
        method: "POST",
        body: JSON.stringify({
          printerId,
          contentType,
          content,
          options: opts.options || {}
        })
      });
    }

    /** Print an HTML string (your styled receipt markup). */
    printHTML(html, opts = {}) {
      return this.print("html", html, {
        ...opts,
        options: { paper: { widthMm: opts.widthMm || 80 }, ...(opts.options || {}) }
      });
    }

    /** Print an element from the page by its id or a DOM node. */
    printElement(elementOrId, opts = {}) {
      const el =
        typeof elementOrId === "string"
          ? document.getElementById(elementOrId)
          : elementOrId;
      if (!el) throw new Error("Receipt element not found");

      // Inline the page's stylesheets so the receipt renders identically
      const styles = Array.from(document.styleSheets)
        .map((sheet) => {
          try {
            return Array.from(sheet.cssRules).map((r) => r.cssText).join("\n");
          } catch (e) {
            return ""; // cross-origin stylesheet, skip
          }
        })
        .join("\n");

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <style>${styles}
          body { margin: 0; padding: 0; font-family: monospace; }
        </style></head><body>${el.outerHTML}</body></html>`;

      return this.printHTML(html, opts);
    }

    /** Print plain text. */
    printText(text, opts = {}) {
      return this.print("text", text, opts);
    }

    /** Print a base64 PDF (with or without the data: prefix). */
    printPDF(base64, opts = {}) {
      return this.print("pdf", base64, opts);
    }

    /** Print a base64 PNG/JPG image. */
    printImage(base64, opts = {}) {
      return this.print("image", base64, opts);
    }

    /**
     * Fastest path for thermal printers. Pass a string, or an array of ops:
     *   [{type:'align',value:'center'}, {type:'text',value:'MY SHOP'}, {type:'cut'}]
     */
    printReceipt(ops, opts = {}) {
      return this.print("escpos", ops, opts);
    }

    /**
     * Fills a <select> with the available printers and remembers the choice.
     */
    async populatePrinterSelect(selectElementOrId) {
      const select =
        typeof selectElementOrId === "string"
          ? document.getElementById(selectElementOrId)
          : selectElementOrId;
      if (!select) throw new Error("Select element not found");

      const printers = await this.getPrinters();
      select.innerHTML = "";

      printers.forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.deviceId;
        opt.textContent = p.name;
        if (p.deviceId === this.defaultPrinter) opt.selected = true;
        select.appendChild(opt);
      });

      select.addEventListener("change", () => this.setDefaultPrinter(select.value));

      if (!this.defaultPrinter && printers.length) {
        this.setDefaultPrinter(printers[0].deviceId);
      }
      return printers;
    }
  }

  global.POSPrintClient = POSPrintClient;
})(typeof window !== "undefined" ? window : globalThis);
