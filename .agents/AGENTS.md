# iLaundry Workspace Rules & Development Standards

This document establishes the universal rules and constraints for the **iLaundry** web application. All agent sessions operating within this repository must adhere to these standards.

---

## 1. Tech Stack Overview
* **Runtime**: Node.js (Express framework), running on port 5000 in Laragon / Windows.
* **Database**: MySQL via connection pool (`DataFind`, `DataInsert`, `DataUpdate`, `DataDelete` helpers).
* **View Engine**: EJS templates located in `views/` with custom partials (`views/header.ejs`, `views/sidebar.ejs`, etc.).
* **Frontend**: Vanilla JavaScript, jQuery, Bootstrap, DataTables (server-side), JsBarcode, Chart.js.
* **Hardware / Printing**: POS Thermal Printer (80mm / 58mm) & Garment Wash Tag Printer (75mm / 50mm) communicating via local printing server (`http://127.0.0.1:4321`).

---

## 2. Mandatory Coding Invariants

### A. EJS Variable & Data Injection (Critical)
1. **Never use spaced scriptlet tags (`<% -`)** for JSON outputs.
   * ❌ `const data = <% - JSON.stringify(order) %>;` (Evaluates as a silent expression; emits `const data = ;` and crashes the page).
   * ✅ `const data = <%- JSON.stringify(order || {}) %>;` (Unescaped output of raw JSON string into JavaScript).
2. For strings embedded inside HTML attributes or JS strings:
   * ✅ `const store = "<%= (shop && shop.name) ? shop.name : '' %>";`
3. Always provide sensible fallback values (`|| {}`, `|| []`, `|| ''`) in templates to prevent `null` reference errors.

### B. Printing System & Fallback Rule
1. Always support **Dual-Mode Printing**:
   * **Silent Mode**: If the local printing server on port 4321 is reachable and silent printing is enabled, send print payloads directly via `POSPrintClient`.
   * **Native Mode**: If the printing server is offline or silent printing fails, **immediately fall back to Chrome's native print window (`window.print()`)**. Never block the user with dead clicks or silent failures.
2. For cloth garment tags:
   * Pre-render DOM elements and Barcodes using `JsBarcode`.
   * Toggle the `.printing-tags` body class for print styling, and restore standard view using `window.addEventListener("afterprint")` plus a timeout fallback.

### C. Server-Side DataTables Pattern
1. All table modules must use server-side processing:
   * `serverSide: true`, `processing: true`.
   * Endpoint pattern: `/module/data` handling `draw`, `start`, `length`, `search[value]`, `order[0][column]`, `order[0][dir]`.
2. Input search box must always be debounced by **400ms** to avoid saturating MySQL connections.
3. Pagination controls and styling must follow the unified design system:
   * Status pills: `badge-status-pill` (`status-completed`, `status-pending`, etc.).
   * Action buttons: `server-dt-actions` with `.btn-dt-action` (`.btn-view`, `.btn-edit`, `.btn-print`, `.btn-delete`).

### D. Server Process Management
1. The server runs as a daemon/service on port 5000.
2. If `npm start` fails with `EADDRINUSE: address already in use :::5000`, the server is already active and handling requests. Test endpoints directly with HTTP requests rather than blindly terminating the server.

### E. AI Agent Testing Protocol (Strict Ban on Chrome Browser Testing)
1. **Never test anything in Chrome browser**: The AI agent must **never** launch `browser_subagent`, open Chrome browser pages, or perform automated browser interactions.
2. **Acceptable Verification Methods**:
   * Automated verification scripts in Node.js (e.g. `validate-ejs.js`, `check-print-server.js`).
   * HTTP requests via `node -e`, `curl`, or endpoint pinging.
   * Unit tests, linters, and syntax compilers.
   * Server terminal log inspection.
3. **User-Owned Visual Testing**: Visual and interactive browser testing is strictly reserved for the human user. Inform the user how to test the UI manually instead of running browser automation.

### F. Pure Bootstrap UI Standard & Custom CSS Prohibition
1. **Always Use Bootstrap Components**:
   * All UI layouts, forms, buttons, cards, modals, tables, badges, and alerts must be constructed exclusively with standard Bootstrap components and classes.
2. **Custom CSS Restriction (Two Established Files Only)**:
   * The application has exactly **two** maintained CSS files for custom styling:
     * `public/css/liquid-glass-theme.css` — Global glassmorphism design system, dark theme adaptations, component-level styling (header, notifications, reports, calendar icons, frosted menus).
     * `public/css/server-datatable.css` — Server-side DataTables unified design system (badge pills, action buttons, pagination).
   * ❌ Do **not** create any additional `.css` files.
   * ❌ Do **not** write `<style>` blocks in EJS view files.
   * ❌ Do **not** use inline `style="..."` attributes for layout, colors, margins, or padding (minimal exceptions allowed for fixed-dimension elements like icons or avatars where Bootstrap utilities are insufficient).
3. **Purely Use Bootstrap Utility Classes**:
   * **Spacing**: `m-0`, `my-2`, `mb-3`, `p-2`, `px-3`, `py-4`, `gap-2`, `gap-3`.
   * **Flexbox & Grid**: `d-flex`, `align-items-center`, `justify-content-between`, `flex-wrap`, `row`, `col-12`, `col-md-6`.
   * **Typography & Colors**: `fw-bold`, `fw-normal`, `text-muted`, `text-primary`, `text-success`, `text-danger`, `fs-6`, `lh-base`.
   * **Borders & Backgrounds**: `border`, `border-0`, `rounded`, `rounded-pill`, `bg-light`, `bg-white`.
   * **Components**: `.btn`, `.btn-primary`, `.btn-outline-secondary`, `.btn-sm`, `.card`, `.card-body`, `.badge`, `.alert`, `.modal`.
4. **Thermal Printer Exemption**:
   * Physical printer media queries and page dimensions (`@page { size: 80mm auto; margin: 0; }`) for 80mm / 58mm thermal receipts and 75mm / 50mm garment wash tags are exempt from this restriction.

### G. Express Route Response Guarantee (Critical)
1. **Never leave any route branch without an explicit HTTP response**:
   * Every Express route handler (`router.get`, `router.post`, etc.) must return a response (`res.json(...)`, `res.redirect(...)`, or `res.status(...).send(...)`) across **all** code paths—including success blocks, validation failures, demo write checks, and `catch` blocks.
   * ❌ Leaving an async route handler to finish without calling a response method causes client AJAX requests to hang indefinitely until browser timeout.
2. For AJAX/API endpoints (such as status switches or JSON lookups):
   * Always respond with JSON: `return res.status(200).json({ success: true, ... });`.
   * On error or unauthorized state: `return res.status(400|403|500).json({ success: false, message: ... });`.

### H. MySQL Boolean & Status Flag Typing Invariant
1. In the iLaundry database schema, boolean flags (e.g. `approved`, `active`, `delet_flage`, `roll_status`) are frequently stored as `VARCHAR` strings (`'1'` / `'0'`).
2. **Never use strict integer equality (`=== 1`) on database status fields**:
   * ❌ `if (data === 1)` (Fails silently when `data` is string `'1'`).
   * ✅ `if (String(data) === '1')` or `if (Number(data) === 1)` or `if (data == 1)`.
3. In inline toggle switches:
   * Read the direct DOM state (`this.checked`) instead of calculating toggled states from rendered data parameters.
   * Normalize backend inputs:
     ```javascript
     const status = (raw === 'active' || raw === '1' || raw === 1 || raw === true) ? '1' : '0';
     ```

### I. DataTables Dynamic Modal Actions & Submission Guard
1. **No Duplicate IDs on Row Elements**:
   * Action buttons rendered per row inside DataTables must use CSS classes (`.btn-staff-edit`, `.btn-manage-role`, `.btn-delete`), **never** repeated `id="..."` attributes.
2. **Dual-Binding Modal Population**:
   * Bind modal population to both row button click AND Bootstrap's `show.bs.modal` event (`e.relatedTarget`) to guarantee fields and dynamic form `action` URLs are assigned regardless of how the modal is triggered.
3. **Property vs. Attribute Invariant**:
   * Always use `.prop('checked', boolean)` for checkboxes and switches; never use `.attr('checked', ...)`.
   * Always use `.val(value)` for inputs and selects; never use `.attr('value', ...)`.
4. **Form Submission Destination Guard**:
   * Any modal form whose `action` URL is dynamically assigned via JavaScript must include an explicit submit guard to prevent browser navigation to a blank page or 404:
     ```javascript
     $('#formId').on('submit', function (e) {
         const action = $(this).attr('action');
         if (!action || action === '' || action.includes('undefined')) {
             e.preventDefault();
             alert('Invalid destination: please re-open the dialog and try again.');
             return false;
         }
     });
     ```

