# iCleaners Workspace Rules & Development Standards

This document establishes the universal rules and constraints for the **iCleaners** web application. All agent sessions operating within this repository must adhere to these standards.

---

## 1. Tech Stack & Multi-Project Ecosystem Overview
The iCleaners platform is organized as a unified multi-project monorepo containing three specialized services:
* **`laundry-cms` (Core Web Application & ERP)**:
  * **Runtime**: Node.js (Express framework), running on port 5000 in Laragon / Windows.
  * **Database**: MySQL via connection pool (`DataFind`, `DataInsert`, `DataUpdate`, `DataDelete` helpers).
  * **View Engine**: EJS templates located in `views/` with custom partials (`views/header.ejs`, `views/sidebar.ejs`, etc.).
  * **Frontend**: Vanilla JavaScript, jQuery, Bootstrap 5 + Liquid Glass theme, DataTables (server-side), JsBarcode, Chart.js.
* **`printing-server` (Local Hardware Printing Daemon)**:
  * **Runtime**: Hybrid Electron & Node.js Express server (`server.js`, `main.js`), running on port 4321.
  * **Hardware / Printing**: POS Thermal Printer (80mm / 58mm) & Garment Wash Tag Printer (75mm / 50mm) communicating via local printing server (`http://127.0.0.1:4321`) with physical paper-cutter sequencing and cash drawer kicking.
* **`brand-reader-ocr` (Garment Brand & Tag OCR Recognition Microservice)**:
  * **Runtime**: Python 3 (Flask), WSGI Phusion Passenger compatible (`passenger_wsgi.py`), running on port 5050 / local/cPanel WSGI.
  * **Computer Vision / AI**: OpenCV (`opencv-python-headless`) + RapidOCR ONNX (`rapidocr-onnxruntime`) + RapidFuzz fuzzy brand matching (`brands.xlsx` / `tbl_garment_brands`).

---

## 2. Mandatory Coding Invariants

### A. EJS Variable & Data Injection (Critical)
1. **Never use spaced scriptlet tags (`<% -`)** for JSON outputs.
   * ❌ `const data = <% - JSON.stringify(order) %>;` (Evaluates as a silent expression; emits `const data = ;` and crashes the page).
   * ✅ `const data = <%- JSON.stringify(order || {}) %>;` (Unescaped output of raw JSON string into JavaScript).
2. For strings embedded inside HTML attributes or JS strings:
   * ✅ `const store = "<%= (shop && shop.name) ? shop.name : '' %>";`
3. Always provide sensible fallback values (`|| {}`, `|| []`, `|| ''`) in templates to prevent `null` reference errors.
4. **Defensive Variable Access & Undeclared Global Protection (`typeof <var> !== 'undefined'`)**:
   * In EJS, accessing an undeclared variable directly (e.g. `if (orderdata)` or `<%- scriptFile %>`) triggers a fatal JavaScript `ReferenceError` if the controller did not include it in `res.render(...)` or `res.locals`.
   * Never assume a variable exists in template scope. Always guard optional locals with `typeof`:
     ```javascript
     const activeOrder = (typeof order !== 'undefined' && order)
       ? order
       : ((typeof orderdata !== 'undefined' && orderdata && orderdata[0]) ? orderdata[0] : {});
     ```
   * When injecting partial script variables or optional assets:
     ```ejs
     <%- typeof scriptFile !== 'undefined' ? scriptFile : '' %>
     ```

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
2. **Custom CSS Restriction (Three Established Files Only)**:
   * The application has **three** maintained CSS files for custom styling:
     * `public/css/liquid-glass-theme.css` — Global glassmorphism design system, dark theme adaptations, component-level styling (header, notifications, reports, calendar icons, frosted menus).
     * `public/css/server-datatable.css` — Server-side DataTables unified design system (badge pills, action buttons, pagination).
     * `public/css/pos-compact.css` — POS compact cart layout, input sizing, and numeric spin-arrow suppression (`.no-spin-arrows`).
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
5. **Dark Theme Completeness & Ban on Hardcoded `bg-light` / `btn-light`**:
   * Never use unadapted Bootstrap `bg-light` or `btn-light .text-dark` on interactive elements, badges, buttons, or checkbox wrappers inside views that support dark theme.
   * Use `.ready-day-pill`, `.settings-toggle-row`, or dedicated dark-adapted classes (`bg-light-subtle`, `border-subtle`).
   * Interactive buttons in the POS cart (`.pos-btn-color.has-color`) must have explicit dark theme styles in `pos-compact.css`: `#1e293b` background, `#475569` border, and high-contrast `#f8fafc` text. Circular swatch dots must include a subtle `1px solid rgba(255, 255, 255, 0.35)` outline so dark swatches (Black, Charcoal, Navy) stand out crisply against dark backgrounds.
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
### P. Customer Name Partitioning & Phone-Based Default Authentication Invariant
1. **Name Field Partitioning & Display Order**:
   * In `tbl_customer`, customer names are split into `first_name` and `last_name`.
   * Across customer tables, POS customer dropdowns, and details views, format and display customer names as: **`Last Name, First Name`** (e.g., `Smith, John`).
2. **Default Credential Generation**:
   * When registering or adding customers, the customer's phone number (`mobile_no`) serves as both the default `username` and default `password` (hashed via md5/bcrypt per repository convention) if explicit credentials are not entered.

### Q. POS Rate & Quantity Input Dimensions Invariant
1. **Rate Field Minimum Visibility**:
   * POS line-item inputs for rates/prices must provide adequate width (`min-width: 85px` - `95px` or `w-100` in dedicated flex containers) to completely display decimal rates up to `###.##` without truncation or clipping.
   * Step intervals must support `0.25` increments on rate and quantity inputs where fractional pricing applies.
2. **Quantity Field Clearance**:
   * POS line item quantity inputs must maintain sufficient width to display integers or decimal quantities with responsive spin controls.

### R. Service Type & Item Catalog Sequencing Invariant
1. **Integer Sequence Storage**:
   * Both service types (`tbl_services_type`) and service entries (`tbl_services`) maintain an explicit integer sequence ordering column (`sequence_no INT NOT NULL DEFAULT 0`).
2. **Default Ascending Sequence Sorting**:
   * Server-side DataTables and list views for service types and services must sort by `sequence_no ASC, id DESC` by default.
3. **Automatic Sequence Pre-calculation**:
   * Creation modals and forms must pre-calculate the next available sequence index per store (`(MAX(sequence_no) + 1)` with fallback to `1`) to streamline intake.

### S. Three-Tier Route & Ready Scheduling Invariant
1. **Three Distinct Schedules**:
   - **Route Pick-up Schedule (`pickup_date`)**: Driver trip to pick up garments from the customer. Visible and required only when intake is Route (`R & R`, `R & C`, `Pick-up & Delivery`, `Pick-up & Counter`).
   - **Ready Schedule (`ready_date`)**: Factory/Store cleaning completion target. **Always visible and required across all 4 customer types**. Governed by the automated working days/cutoff schedule with manual override.
   - **Route Delivery Schedule (`delivery_date`)**: Driver trip to deliver clean garments to the customer. Visible and required only when dispatch is Route (`R & R`, `C & R`, `Pick-up & Delivery`, `Counter & Delivery`).
2. **Counter & Counter (`C & C`) Clean View Rule**:
   - For `Counter & Counter`: ONLY the **Ready Schedule** is visible and required in the POS header and payment modal. Driver pickup and delivery schedule groups must be strictly hidden.
3. **Database Persistence & Backwards Compatibility**:
   - Persist `ready_date` (`TIMESTAMP NULL`), `pickup_date` (`TIMESTAMP NULL`), and `delivery_date` (`TIMESTAMP NULL`) across both `tbl_cart` and `tbl_order`.
   - For orders with Counter delivery (`C & C`, `R & C`), always keep `delivery_date` synchronized with `ready_date` in database records to preserve compatibility with existing legacy reports.

### T. Unified Orders & Recent Orders Table Architecture Invariant
1. **Parity Between Orders Page & Dashboard Tables**:
   * The Recent Orders list on both the Main Dashboard (`views/index.ejs`) and Staff Dashboard (`views/staff_dashboard.ejs`) must maintain 100% visual, structural, and functional parity with the main Orders list (`views/order.ejs`).
2. **Standard 7-Column Layout**:
   * **Col 1 (Order Number)**: Order ID link (`/order/view/:id`) and Order Type badge (`badge bg-light text-dark border py-1 px-2`).
   * **Col 2 (Order Date)**: Formatted Order Date and dynamic Pick-up/Delivery schedule dates.
   * **Col 3 (Customer Name)**: Customer Name (`Last Name, First Name` or Walk In Customer) and customer phone number with telephone icon.
   * **Col 4 (Order Amount)**: Gross total formatted to 2 decimals with `.symbol font-w600`.
   * **Col 5 (Payment)**: Secondary breakdown (`Total: gross | Paid: paid`), plus interactive `Add Payment` button calling `open_patment_model(id)` if balance > 0, or `Fully Paid` badge if settled.
   * **Col 6 (Status)**: Status pill `.badge-status-pill ${data.statusClass}` (`status-pending`, `status-processing`, `status-ready`, `status-delivered`, `status-returned`, `status-cancelled`) plus `0 Items (Pending Intake)` badge when applicable.
   * **Col 7 (Actions)**: Standard `.server-dt-actions` with `.btn-dt-action` toolbar:
     - 👁️ View (`.btn-view` to `/order/view/:id`)
     - ✏️ Edit (`.btn-edit` to `/admin/edit/:id` if `canEdit` and not cancelled)
     - 🏷️ Barcode Modal (`.btn-print #print_barcode` opening `#exampleModalLong`)
     - 🧾 POS Thermal Invoice (`.btn-print` to `/order/pos_invoice/:id` in new tab)
     - 🗑️ Delete Modal (`.btn-delete` opening `#deleteOrderModal` if `canDelete`)
3. **Companion Modal Trio Invariant**:
   * Any view rendering this table must include the companion modal trio before the footer:
     - `#addpaymentmodel1`: Add payment modal with select2 payment method dropdown.
     - `#exampleModalLong`: Barcode preview and printing modal.
     - `#deleteOrderModal`: Safe delete confirmation dialog with dynamic order code and destination URL assignment.
4. **Backend Row Enrichment**:
   * Routes querying orders for dashboard tables must pass rows through `enrichRecentOrders()` to compute `formattedOrderDate`, `formattedDeliveryDate`, `formattedPickupDate`, `order_type`, `statusClass`, `canDelete`, `canEdit`, and `balance_amount`.

### U. String Enum Refactoring & Dual-State Backwards Compatibility Invariant
1. **Never Break Historical Records on Enum Renaming**:
   * When renaming database-persisted business strings (such as `order_type`, `order_status`, or payment methods), never assume 100% of historical records can or will be migrated instantly.
2. **Compound Boolean Condition Rule**:
   * All client-side UI handlers, template display conditions, and backend logic must check both the new canonical values AND legacy values:
     ```javascript
     const isDelivery = (
       type === 'Counter & Delivery' || 
       type === 'Pick-up & Delivery' || 
       type === 'Customer drop-off & Store delivery' || 
       type === 'Store collection & Store delivery'
     );
     ```
3. **Default Assignment**:
   * Always default new carts, intake forms, and fallback assignments strictly to the new canonical value (e.g. `'Counter & Counter'`).

### V. Universal Zero-Item Order Creation & Intake Manifest Invariant
1. **Universal 0-Item Order Creation**:
   - The application strictly permits generating orders with 0 service items ($0.00 gross, $0.00 paid, $0.00 balance) across **all order types** (`Counter & Counter`, `Counter & Route`, `Route & Route`, `Route & Counter`).
   - This enables:
     - **Counter Intake**: Registering a customer drop-off ticket before clothes are sorted, counted, or inspected.
     - **Route Pick-up**: Providing drivers with an official Route Pick-up Manifest / Driver Ticket before clothes arrive at the cleaning plant.
2. **Dynamic POS Action Button**:
   - When active cart items count is 0 (`serviselength < 1`):
     - Route Intake (`Route & Route`, `Route & Counter`): Button displays `"Schedule Route Pick-up"` (`.btn-primary`, `fa-truck-pickup`).
     - Counter Intake (`Counter & Counter`, `Counter & Route`): Button displays `"Save Order (0 Items)"` (`.btn-warning`, `fa-clipboard-check`).
     - Clicking the button bypasses the cash/card breakdown modal and submits `#posprintform` directly with customer ID and store ID.
   - When cart items count >= 1:
     - Button displays `"Payment"` (`.btn-success`, `fa-arrow-right`) and opens `#POS_payment_model_show`.
3. **Thermal Receipt Intake & Driver Manifest**:
   - When printing an order with 0 services (`views/posprint.ejs`):
     - Route orders display a prominent centered **"ROUTE PICK-UP MANIFEST"** banner.
     - Counter orders display a prominent centered **"ORDER INTAKE (0 ITEMS)"** banner.
     - Cloth garment wash tags and auto-cutter sequences are safely bypassed until items are added.
4. **Barcode Modal & Order List Handling**:
   - Barcode preview modal (`#exampleModalLong`) displays an empty-state notification instead of generating empty barcode strips.
   - Orders list and dashboard tables render a status badge `<span class="badge bg-warning-subtle text-dark border border-warning">0 Items (Pending Intake)</span>` to highlight unpriced intake tickets.
5. **Intake Completion via Order Edit**:
   - Once garments are inspected and counted, staff opens `/admin/edit/:id` to add service items, recalculate gross totals, and collect payment.

### W. Customer Address Field Partitioning Invariant
1. **Four Partitioned Database Fields**:
   - In `tbl_customer`, customer address is strictly partitioned into:
     - `address` (`VARCHAR(255)` - Street address, Required)
     - `city` (`VARCHAR(100)` - City, Required)
     - `state` (`VARCHAR(100)` - State / Province, Required)
     - `zip_code` (`VARCHAR(20)` - Zip / Postal Code, Optional)
2. **Universal Form Parity**:
   - All customer creation and edit forms—including Admin Customer Create (`coustomer_create.ejs`), Public Customer Registration (`customer_register.ejs`), Customer Edit (`coustomer_edit.ejs`), and POS Quick Add Modal (`pos.ejs`, `pos_edit.ejs`)—must collect and validate these partitioned fields individually.

### X. Reverse Chronological Order Sorting Invariant
1. **Default Ordering Protocol**:
   - All order tables—including Server-Side DataTables (`/order/list`, `/order/list/data`), Dashboard Recent Orders (`views/index.ejs`, `views/staff_dashboard.ejs`), and Customer Portal order views—must sort with the most recent orders on top by default:
     ```sql
     ORDER BY tbl_order.id DESC, tbl_order.order_id DESC
     ```
2. **Consistent User Experience**:
   - Never sort order lists in ascending order by default, as cashiers and store managers expect newly created orders to appear immediately at row 1.

### Y. Font Awesome Icon Package Standard & Raw SVG Prohibition
1. **Never Embed Multi-line Raw SVGs in Views**:
   * EJS views, navigation templates, buttons, badges, and partials must **never** embed raw, multi-line `<svg viewBox="...">` elements.
2. **Canonical Icon Package (Font Awesome)**:
   * The project standardizes on **Font Awesome 5/6** (`public/icons/font-awesome/css/all.min.css`):
     - Sidebar / Navigation: `<i class="fa fa-cash-register"></i>`, `<i class="fa fa-receipt"></i>`, `<i class="fa fa-calendar-alt"></i>`.
     - Actions: `<i class="fa fa-eye"></i>`, `<i class="fa fa-edit"></i>`, `<i class="fa fa-trash"></i>`, `<i class="fa fa-print"></i>`.
     - Status: `<i class="fa fa-check-circle"></i>`, `<i class="fa fa-clock"></i>`, `<i class="fa fa-box"></i>`, `<i class="fa fa-truck"></i>`.
3. **Preserve Script Hook Classes**:
   * Interactive theme toggle icons must retain their operational hook classes:
     - Moon: `<i class="fa fa-moon lighticon fs-5"></i>`
     - Sun: `<i class="fa fa-sun darkicon fs-5"></i>`
4. **Styling & Sizing**:
   * Control icon dimensions and spacing exclusively with Bootstrap utility classes (`fs-5`, `fs-6`, `me-1`, `me-2`) and centralized rules in `public/css/liquid-glass-theme.css`.

### Z. Real-Time Route Calendar & Dispatch Schedule Protocol
1. **Order Type Filtering Rules**:
   - **Counter & Counter (`C & C`)**: Strictly excluded from the Route Calendar (no route events).
   - **Route & Route (`R & R`)**: Generates two distinct calendar events:
     - **Pick-up Event**: Pending in Orange (`#ea580c`, `fa-box`); Completed in Green (`#16a34a`).
     - **Delivery Event**: Pending in Blue (`#2563eb`, `fa-truck`); Completed in Green (`#16a34a`).
   - **Counter & Route (`C & R`)**: Generates only the Route Delivery event.
   - **Route & Counter (`R & C`)**: Generates only the Route Pick-up event.
2. **Compact Time-Badge Display & Same-Date Chronological Sorting**:
   - Calendar day cells render each event as a compact single-line pill badge displaying only the icon, formatted time (`hh:mm A`), and completion checkmark (`✓`), with `eventLimit: 6` (`+N more` popover).
   - Events on the same date are sorted chronologically by time (`sortTime` in minutes from midnight, then `eventTypeRank`, then `title`).
3. **Public Guest Access & URL Store Selector (`/order/calendar/:storeId`)**:
   - `/order/calendar` and `/order/calendar/:storeId` use `optionalAuth` middleware.
   - Unauthenticated visitors see a standalone guest view with a store selector dropdown that navigates directly to `/order/calendar/<id>`, and read-only event inspection modals (status toggle controls hidden).
4. **Pick-up Before Delivery Gating Invariant**:
   - For `Route & Route` orders, the delivery switch/status is strictly locked until pick-up is confirmed (`is_picked_up === '1'`).
   - If an existing pick-up is unchecked, the backend cascades a reset to delivery (`is_delivered = '0'`) to preserve logical state consistency.
5. **Real-Time Multi-Client Synchronization (SSE) & Route Order Admin Alerts**:
   - Calendar events, status toggles, and dispatch actions must broadcast updates via Server-Sent Events (`/order/calendar/stream`).
   - When a customer or staff member places an order with a pick-up or delivery route (`Pick-up & Delivery`, `Pick-up & Counter`, `Counter & Delivery`), the backend inserts an alert in `tbl_notification` and broadcasts `new_route_order` via SSE so Admin and Store Manager sessions receive an immediate clickable toast alert, Web Audio chime, and live topbar bell badge increment.

### AA. Order Details Lifecycle Tracking & Complete Timeline Invariant
1. **Dispatch & Route Tracking Cards**:
   * The Order Details view (`views/order_details.ejs`) must display high-visibility route status cards:
     - **Route Pick-up**: Scheduled date/time, status badge (`Picked Up` / `Pending Pick-up`), completion timestamp (`picked_up_at`), and interactive toggle switch for authorized staff.
     - **Factory Target Ready**: Target cleaning date/time, current laundry status badge, and working days/cutoff schedule indicator.
     - **Route Delivery**: Scheduled date/time, status badge (`Delivered` / `Pending Delivery` / `Locked`), completion timestamp (`delivered_at`), and interactive toggle switch gated by pick-up confirmation.
2. **Comprehensive Order Timeline (`.widget-timeline.style-1`)**:
   * The order timeline must never be restricted solely to payments. It must present the full chronological order lifecycle:
     1. **Order Placed**: Creation date/time, Order ID, and gross amount.
     2. **Route Pick-up**: Confirmation date/time or scheduled date, with status color dot (`success` for picked up, `warning` for pending).
     3. **Cleaning Target**: Factory target completion date and current laundry status.
     4. **Route Delivery / Counter Collection**: Delivery timestamp or scheduled date (`success` for delivered, `primary` for scheduled, `dark` for gated).
     5. **Payment Milestones**: Chronological breakdown of each recorded payment (amount, date, account).
3. **Optimistic AJAX & Dynamic DOM Updates**:
   * Toggling pick-up or delivery must execute an AJAX POST to `/order/calendar/toggle-status`, update status badges and timeline milestone dots dynamically without a full page reload, and display toast feedback.

### AB. POS Declared Garment Value & Store Override Rate (%) Invariant
1. **Store-Level Override Rate Configuration**:
   * `tbl_store.override_rate_percent` (`DECIMAL(5,2) NOT NULL DEFAULT 10.00`) defines the percentage of a garment's declared value charged as the cleaning rate (configurable in Store Settings, Master Store Settings, and Add Store).
2. **POS & Order Edit `Value` Column**:
   * Cart rows in `views/pos.ejs` include a numeric `Value` input (`item_value`, spin arrows hidden via `.no-spin-arrows`) and an inline Reset (`↺`) button.
   * `tbl_cart_servicelist` persists both `item_value` (`DECIMAL(10,2) DEFAULT 0.00`) and `original_rate` (`DECIMAL(10,2) DEFAULT 0.00`).
   * Entering `item_value > 0` overrides `service_price` to `+(item_value * (override_rate_percent / 100)).toFixed(2)`.
   * Clicking Reset (`↺`) or setting `Value` to `0` clears `item_value` and restores `original_rate * (brand_multiplier || 1)`.
3. **Order Details & Thermal Receipt Display**:
   * Display the declared garment value in `views/order_details.ejs` and as an indented sub-line (`Declared Value: $X.XX`) on thermal receipts (`views/pos_print.ejs`) whenever `item_value > 0`.

### AC. Garment Brand Master Catalog & POS Multi-Camera Brand Modal Invariant
1. **Master Brand Table (`tbl_garment_brands`)**:
   * Stores 1,236+ garment brands with `brand_label`, `category` (`REGULAR`, `DESIGNER`, `HIGH-END`, `BESPOKE`), `upcharge_note`, `price_multiplier` (`DECIMAL(5,2)`), and indexed `pos_search_key`.
2. **POS & Order Edit `Brand` Column & Inspection Modal (`#pos_brand_modal`)**:
   * Cart rows in `views/pos.ejs` include a `Brand` column between `Service` and `Color`.
   * Clicking the brand button opens `#pos_brand_modal`, which provides:
     - **Live Brand Search**: Debounced query against `/admin/search_brands` matching `pos_search_key`, displaying Brand Label, Category badge, Upcharges, and Price Multiplier.
     - **Multi-Camera Live Stream**: WebRTC camera preview (`navigator.mediaDevices.enumerateDevices()` + `getUserMedia()`) with a camera switcher dropdown (persisted in `localStorage.pos_brand_camera_id`), Freeze/Capture toggle, and automatic media track release on modal close (`hidden.bs.modal`).
3. **Brand Rate Override Precedence**:
   * Applying a brand persists `brand_id`, `brand_name`, `brand_category`, and `brand_multiplier` in `tbl_cart_servicelist`.
   * When `item_value === 0`, the unit rate is overridden to `+(original_rate * brand_multiplier).toFixed(2)`. If `item_value > 0`, the declared value percentage takes precedence until `item_value` is reset.



### AD. Local Printing Server (Port 4321) & Hardware Daemon Architecture Invariant
1. **Core Architecture & Daemon Management**:
   * The local printing server (`printing-server/`) runs as a hybrid Electron & Node.js Express server (`server.js`, `main.js`) on default port 4321 (configured in `config.json` and `config.js`). Always handle `EADDRINUSE` gracefully.
   * Electron operates as a background daemon minimized to the Windows system tray (`tray/`). Background operation must remain unbroken during lifecycle events.
2. **CORS & Private Network Access (PNA) Invariants**:
   * **PNA Header**: Modern Chromium browsers require `Access-Control-Allow-Private-Network: true` when public HTTPS sites (e.g. `https://icleanders.com`) communicate with local loopback endpoints (`http://127.0.0.1:4321`). Never remove or bypass this middleware.
   * **Preflight Handling**: Route all preflight OPTIONS requests with `app.options("*", cors(corsOptions))` so browser preflight queries resolve with 200/204 before print payloads are dispatched.
   * **Origin Whitelist**: Keep `allowedOrigins` in `config.json` and `$env:USERPROFILE\.pos-printing-server\config.json` aligned with production domains.
3. **Printer & ESC/POS Protocol Constraints**:
   * Thermal ESC/POS commands (`escposService.js`) write raw binary buffers. Always validate printer status and wrap socket/USB writes in `try/catch`.
   * Never send raw binary print commands without paper-cut or feed safety delimiters. Keep `printerService.js` and `escposService.js` decoupled from Express route handlers.
4. **Logging & Diagnostic Workflows**:
   * Use `logger.js` for operational and print event logging instead of unformatted `console.log`.
   * Utilize `.agents/skills/printer-diagnostics/` workflows for health checks, PNA testing, and packaging via `npm run build:win`.

### AE. Garment Brand OCR Service & Tag Recognition Microservice Invariant
1. **Core Architecture & Passenger Compatibility**:
   * The garment brand recognition microservice (`brand-reader-ocr/`) runs as a lightweight Flask application with Phusion Passenger WSGI compatibility (`passenger_wsgi.py`, `application = app`).
   * **Single-Thread Environment Limits**: To prevent thread starvation and memory spikes on cPanel shared hosting, single-thread environment variables (`OMP_NUM_THREADS="1"`, `OPENBLAS_NUM_THREADS="1"`, `MKL_NUM_THREADS="1"`, `VECLIB_MAXIMUM_THREADS="1"`, `NUMEXPR_NUM_THREADS="1"`) must be defined before importing NumPy, OpenCV, or ONNX Runtime.
   * **Lazy Engine Initialization**: The ONNX OCR engine (`NeckTagOCRPipeline`) must be lazy-loaded on the first `/api/scan` request protected by a thread lock (`threading.Lock()`), avoiding Passenger worker boot timeouts.
2. **Unified Image Decoding & Request Contract**:
   * `/api/scan` accepts three flexible image inputs:
     1. Multipart file upload (`request.files["image"]`).
     2. Sample filename (`data["sample"]`) loaded safely from `samples/`.
     3. Base64-encoded image string (`data["image_base64"]`), supporting both raw base64 and data-URI prefixes (`data:image/...;base64,...`).
3. **Threshold Scoring & Brand Catalog Synchronization**:
   * OCR text candidates are fuzzy-matched against the 1,236+ brand catalog via RapidFuzz with configurable confidence threshold (default 80.0%).
   * Candidate rankings return `pos_search_key`, `brand_label`, `category`, and `match_score` for seamless pairing with the POS modal (`#pos_brand_modal`).
   * Updates to brand classifications in MySQL `tbl_garment_brands` must be mirrored in `brand-reader-ocr/brands.xlsx`.

### AF. Multi-Project Monorepo Structure & Unified Agent Discovery
1. **Single Source of Truth**:
   * All agent rules ([`.agents/rules/`](file:///e:/Products/Laragon_Laundary/www/.agents/rules/)), skills ([`.agents/skills/`](file:///e:/Products/Laragon_Laundary/www/.agents/skills/)), plugins ([`.agents/plugins/`](file:///e:/Products/Laragon_Laundary/www/.agents/plugins/)), and master standards ([`.agents/AGENTS.md`](file:///e:/Products/Laragon_Laundary/www/.agents/AGENTS.md)) reside strictly at the workspace root (`E:\Products\Laragon_Laundary\www\.agents`).
2. **Subproject Isolation**:
   * Subprojects (`laundry-cms/`, `printing-server/`, `brand-reader-ocr/`) must **never** maintain isolated or duplicate `.agents/` folders.
   * All tools, build scripts, and diagnostic runbooks for any service are centralized in the root `.agents` directory for unified discovery across agent sessions.

### AG. Garment Inspection Color & Pattern Catalog Invariant
1. **Catalog Definitions (23 Colors, 21 Patterns)**:
   * **23 Standard Colors**: Black (`#000000`), White (`#FFFFFF`, border), Gray (`#808080`), Charcoal (`#36454F`), Navy (`#000080`), Blue (`#2563EB`), Light Blue (`#93C5FD`), Red (`#DC2626`), Burgundy (`#800020`), Pink (`#F472B6`), Purple (`#800080`), Lavender (`#E6E6FA`, border), Green (`#16A34A`), Olive (`#808000`), Yellow (`#EAB308`), Orange (`#F97316`), Brown (`#8B4513`), Beige (`#F5F5DC`, border), Cream (`#FFFDD0`, border), Khaki (`#C3B091`), Multi-Color (rainbow gradient), Other (`#94A3B8`), Unknown (`#64748B`).
   * **21 Garment Patterns**: Solid (default), Striped, Pinstripe, Plaid, Checkered, Gingham, Houndstooth, Herringbone, Polka Dot, Floral, Paisley, Geometric, Animal Print, Camouflage, Abstract / Graphic, Embroidered, Printed, Textured, Color Block, Other, Unknown.
2. **Modal Inspection UI & Persistence**:
   * `#pos_brand_modal` displays 3 Select2 dropdowns: Primary Color, Secondary Color (optional), and Garment Pattern.
   * Persisted in `tbl_cart_servicelist`: `primary_color` (`VARCHAR(50)`), `secondary_color` (`VARCHAR(50)`), `garment_pattern` (`VARCHAR(50) DEFAULT 'Solid'`), and `service_color` (hex value of primary color).
3. **Minimalist Display Rule**:
   * In cart rows, order details, and receipts:
     - Secondary color is displayed with `/` only when present (`Primary / Secondary`).
     - Garment pattern is badged/printed only when `garment_pattern !== 'Solid'`.
4. **Simultaneous Modal Clear**:
   * Clicking `#btn_pos_clear_brand` resets Brand (to 0 and restores original rate), Primary Color (`""`), Secondary Color (`""`), Pattern (`'Solid'`), and resets `service_color` to `'#000000'`.

### AH. POS Hourly Time-Slot Scheduling Invariant
1. **Discrete 1-Hour Time Slots**:
   * In `views/pos.ejs`, Route Pick-up (`#POS_pickup_time`) and Route Delivery (`#POS_delivery_time`) inputs accept **Date and Hour only**.
   * Replaces arbitrary minute inputs (`<input type="time">`) with a `<select class="form-select pos-input-sm">` populated with 24 hourly increments (`00:00` to `23:00`), labeled in 12-hour format with AM/PM (e.g. `09:00 AM`, `02:00 PM`).
2. **Sync & Normalization**:
   * Automatic event listeners normalize existing timestamps (e.g. `10:30` -> `10:00`) when populating from cart state or radio selections.
   * Persisted as standard MySQL timestamps (`YYYY-MM-DD HH:00:00`).
