# iCleaners Workspace Rules & Development Standards

This document establishes the universal rules and constraints for the **iCleaners** web application. All agent sessions operating within this repository must adhere to these standards.

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

### B. Printing System & Combined Thermal Print Invariant
1. Always support **Dual-Mode Printing**:
   * **Silent Mode**: If the local printing server on port 4321 is reachable and silent printing is enabled, send print payloads directly via `POSPrintClient`.
   * **Native Mode**: If the printing server is offline or silent printing fails, **immediately fall back to Chrome's native print window (`window.print()`)**. Never block the user with dead clicks or silent failures.
2. **Combined Single-Click Print & Hardware Cutter Separation**:
   * The default POS print option must be **"All (Invoice + Tags)"**, displaying the customer invoice receipt on top, red dashed cutter guides (`✂ AUTO CUTTER CUTS HERE ✂`), and garment cloth tags below.
   * **Hardware Cutter Execution**: In silent mode, send the receipt as Job 1 with `cut: true`, followed sequentially by each individual cloth tag as separate print jobs with `cut: true` to the **same** thermal printer. This guarantees the physical blade cuts after the invoice and cuts after each individual garment tag.
   * **Native Print Separation**: Style `.receipt-container` and each `.cloth-tag` with `page-break-after: always; break-after: page;` to trigger auto-cutters on native printer spoolers.
3. **Segmented Mode Switcher**:
   * Provide a segmented pill selector in the sticky toolbar: `All (Invoice + Tags)` [Default], `Invoice Only`, and `Cloth Tags Only`. Switching pills dynamically toggles the screen preview and updates the primary single-click print button.
4. **Cloth Garment Tags Pre-rendering**:
   * Pre-render DOM elements and Barcodes using `JsBarcode` on page load so tags and cut guides are immediately visible and ready in memory.

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
5. **Dark Theme Completeness & Ban on Hardcoded `bg-light`**:
   * Never use unadapted Bootstrap `bg-light` on interactive elements, badges, or checkbox wrappers inside views that support dark theme.
   * Use `.ready-day-pill`, `.settings-toggle-row`, or dedicated dark-adapted classes (`bg-light-subtle`, `border-subtle`).
   * Custom banner headers (e.g. `.settings-banner`), cards, and badges must provide explicit `[data-theme-version="dark"]` rules with high-contrast text (`#f8fafc` titles, `#94a3b8` subtitles) and translucent colored glass borders.

### G. Express Route Response Guarantee (Critical)
1. **Never leave any route branch without an explicit HTTP response**:
   * Every Express route handler (`router.get`, `router.post`, etc.) must return a response (`res.json(...)`, `res.redirect(...)`, or `res.status(...).send(...)`) across **all** code paths—including success blocks, validation failures, demo write checks, and `catch` blocks.
   * ❌ Leaving an async route handler to finish without calling a response method causes client AJAX requests to hang indefinitely until browser timeout.
2. For AJAX/API endpoints (such as status switches or JSON lookups):
   * Always respond with JSON: `return res.status(200).json({ success: true, ... });`.
   * On error or unauthorized state: `return res.status(400|403|500).json({ success: false, message: ... });`.

### H. MySQL Boolean & Status Flag Typing Invariant
1. In the iCleaners database schema, boolean flags (e.g. `approved`, `active`, `delet_flage`, `roll_status`) are frequently stored as `VARCHAR` strings (`'1'` / `'0'`).
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

### J. Feature Flags & Environment Toggle Invariant
1. **Normalization & Fallback**:
   * All boolean flags in `config.env` (e.g. `show_demo_accounts`, `enable_store_signup`) must be parsed with case-insensitive string normalization:
     ```javascript
     const isEnabled = process.env.FLAG !== undefined
       ? String(process.env.FLAG).trim().toLowerCase() === "true"
       : true; // Default fallback to true for backward compatibility
     ```
2. **Global View Availability**:
   * Register feature flags in `app.js` under `res.locals` so that all EJS templates have reliable, safe access without undefined variable errors:
     ```javascript
     res.locals.show_demo_accounts = ...;
     res.locals.enable_store_signup = ...;
     ```
3. **Double-Guard Rule (UI + Route Interception)**:
   * When a feature toggle disables a feature (e.g. `enable_store_signup = false`), you must **not** merely hide the link/button in the UI.
   * You **must** also guard the corresponding backend route handlers (`GET` and `POST`) to intercept direct URL access and redirect to `/` or return an unauthorized response.
4. **Template & Script Cleanup**:
   * When omitting a feature from an EJS template (`<% if (flag) { %>`), omit both the DOM markup AND any accompanying JavaScript event listeners (e.g., button click handlers) to prevent dead event listeners in the DOM.

### K. Staff Role Scoping & Permission Guard Invariant
1. **Master vs. Staff Authority**:
   * Master admin accounts (`loginas === 1` or `tbl_admin.store_ID` empty/master) always have unconditional access to administrative actions (bulk upload, edit, delete).
   * Staff accounts (`is_staff === 1` or `loginas === 'staff'`) must always be gated against their specific permission record in `tbl_staff_roll`.
2. **Dedicated Staff Dashboard**:
   * When a staff user logs in, render a tailored, lightweight staff dashboard showing only the orders and sales created by that specific staff member (`created_by === staff_id`) and their recent activity, rather than store-wide or system-wide counters.
3. **Action Button Permission Guards**:
   * In DataTables and details views, never render Edit/Delete action buttons for staff members unless the corresponding permission (e.g., `orders === '1'`, `account === '1'`) is explicitly verified.

### L. Non-Destructive Database Migrations (Zero Data Loss Invariant)
1. **Never Drop Existing Tables or Overwrite Production Dumps**:
   * Under no circumstances may an agent run `DROP TABLE`, `TRUNCATE` live data, or blindly import full SQL dumps over an existing active database.
2. **Idempotent Column Additions**:
   * All schema extensions must be executed using idempotent `SHOW COLUMNS FROM <table>` verification scripts or `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
   * New columns must always provide sensible `DEFAULT` values or allow `NULL` so existing records remain intact and valid without requiring manual data repair.
3. **Automated Migration Runner**:
   * Place database migration scripts in `scratch/` or `database/migrations/` following the `mysql2/promise` inspection pattern (e.g. `scratch/migrate_ready_schedule.js`), and execute them via Node.js before modifying dependent application code.

### M. Automated Ready Schedule & Working Days Invariant
1. **Two-Tier Configuration Fallback**:
   * Global fallback defaults reside in `tbl_master_shop` (`ready_lead_days`, `ready_cutoff_time`, `ready_time`, `ready_working_days`).
   * Store-level records in `tbl_store` inherit global defaults whenever branch fields are `NULL` or empty.
2. **Cut-off Time & Working Days Rule**:
   * Orders intake before `ready_cutoff_time` (e.g. `13:00` / 1:00 PM) require `ready_lead_days` (default 2 working days).
   * Orders intake at or after `ready_cutoff_time` automatically add **+1 day** (3 working days).
   * Closed days (e.g. Sunday = `0` not present in `ready_working_days`) must be skipped during calendar calculation.
3. **POS Dual-State Override & Unified Timestamp Storage**:
   * POS header renders side-by-side date (`#POS_delivery_date`) and time (`#POS_delivery_time`) inputs with a "Reset to Auto" (`#btn_auto_ready_schedule`) button.
   * Manual edits by the cashier flag the state as manual and highlight the button in amber; clicking "Auto" recalculates automatically.
   * Delivery dates are persisted in MySQL `timestamp` fields (`tbl_cart.delivery_date`, `tbl_order.delivery_date`) formatted as `YYYY-MM-DD HH:MM:00` to preserve both date and time across printing receipts and wash tags.

### N. Multi-Piece Service & Garment Wash Tag Invariant
1. **Service-Level Piece Count Storage**:
   * Store-level services maintain an independent physical piece count in `tbl_services.no_of_items` (`INT NOT NULL DEFAULT 1`).
   * When an item is added to an active cart or order, persist this piece count into `tbl_cart_servicelist.no_of_items`.
2. **Minimalist Badge Display Rule**:
   * To prevent visual clutter, only display piece count badges/indicators (`<span class="badge">N Pcs</span>`) when `no_of_items > 1` (e.g. `2 Pcs`, `3 Pcs`).
   * For standard single-piece items (`no_of_items === 1` or `null`), omit the badge in catalog cards, cart rows, order summaries, and receipts.
3. **Garment Wash Tag Multiplier Invariant**:
   * Every physical garment piece must receive its own individual cloth wash tag for tracking through cleaning and assembly.
   * Total tags generated per line item equals: `service_quntity * (no_of_items || 1)`.
   * Each tag must be individually indexed with the total piece count (e.g. `Piece 1/4`, `Piece 2/4`, `Piece 3/4`, `Piece 4/4`).

### O. Settings Glass Architecture & Sticky Footer Clearance Invariant
1. **Sticky Save Footer Scroll Clearance**:
   * Any form or view implementing `.settings-sticky-footer` (`position: sticky; bottom: 16px; z-index: 99`) must provide at least `padding-bottom: 90px;` (or `pb-5 mb-5`) on the enclosing `.container-fluid`.
   * Never allow the bottommost section card to sit flush against the bottom edge of the document without clearance, as the floating sticky footer will obscure input fields and buttons during user scrolling.
2. **Full-Width Section Card Height**:
   * Full-width cards (`.col-12 > .settings-section-card`) must always evaluate with `height: auto !important;` (overriding the `height: calc(100% - 24px)` rule used for equal-height multi-column cards).
3. **Strict HTML Tag Balancing in Multi-Card Forms**:
   * Multi-section settings views (`master_settings.ejs`, `store_settings_bymaster.ejs`, etc.) contain deep nested Bootstrap grids. Every opening column (`<div class="col-12">`) and card must be rigorously balanced.
   * Unclosed column wrappers cause subsequent section cards to nest inside preceding columns and pull the sticky footer inside the flex row, breaking grid flow.




