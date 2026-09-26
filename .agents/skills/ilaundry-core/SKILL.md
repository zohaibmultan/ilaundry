---
name: ilaundry-core
description: >-
  Core backend architecture, database conventions, routing, and template safety in iLaundry.
  Includes middleware patterns (auth, access), MySQL helper functions (DataFind, DataInsert),
  and the EJS template compilation linter.
---

# iLaundry Core Architecture & Conventions

This skill provides architectural guidance for developing and debugging backend routes, database interactions, and templates in iLaundry.

## 1. Directory Layout
* `app.js`: Express application bootstrap, middleware setup, route mounting.
* `routers/`: Express routers organized by domain:
  - `pos.js`: POS terminal, order placement, thermal printing routes (`/posprint`).
  - `order.js`: Order management, status transitions, barcode printing, invoices.
  - `customer.js`: Customer management and customer ledger.
  - `master.js`, `store.js`, `service.js`, `expense.js`, etc.
* `views/`: EJS templates and components.
* `public/`: Static assets (JS libraries, CSS styles, images).

## 2. Database Helper Functions
The application uses global helper functions (defined in `database/` or `middleware/`):
* `DataFind(query)`: Executes a raw SQL SELECT query and returns rows array.
* `DataInsert(table, columns, values, host, proto)`: Inserts record and logs license audit.
* `DataUpdate(table, setClause, whereClause, host, proto)`: Updates matching records.
* `DataDelete(table, whereClause)`: Deletes matching records.

## 3. Middleware & Security
* `auth`: Verifies JWT / session token; populates `req.user`.
* `access(req.user)`: Computes tenant access data, store scoping, permissions, and topbar notifications.
* Store isolation: Always scope queries by `store_id` if the user is not superadmin (`loginas !== 1` or `accessdata.masterstore`).

## 4. EJS Template Compilation & Validation
Run the validator anytime EJS templates are created or modified:
`node .agents/skills/ilaundry-core/scripts/validate-ejs.js`

## 5. Store Scoping & Cascading Deletions
When deleting a store or major parent entity, ensure all related child records are cleaned up in order to maintain referential integrity:
* `tbl_order_payment` -> based on orders matching `store_id` or `transferred_from_store_id`.
* `tbl_cart_servicelist` -> based on item IDs referenced in `tbl_order.service_list` and `tbl_cart.service_list_id`.
* `tbl_order` -> `store_id` or `transferred_from_store_id`.
* `tbl_cart` -> `store_id`.
* Services & Addons: `tbl_services`, `tbl_services_type`, `tbl_addons`, `tbl_coupon`.
* Financials: `tbl_expense`, `tbl_exp_cat`, `tbl_exp_cat_type`, `tbl_transections`, `tbl_account`, `tbl_commision`, `tbl_email`.
* Users: `tbl_customer` (`store_ID` or `reffstore`), `tbl_admin` (`store_ID`).
* Parent Store: `tbl_store`.

## 6. Destructive Action Confirmation Modal Standard
Always prompt for confirmation using a centered Bootstrap modal (`#delete<Entity>Modal`) before executing permanent deletions:
* Red circular warning icon (`.fas .fa-exclamation-triangle` in red light circle `rgba(239, 68, 68, 0.12)`).
* Distinct entity name display container (e.g. `#delete<Entity>ModalName`).
* Alert warning highlighting affected cascaded data (`.alert .alert-danger .py-2 .px-3`).
* Cancel button (`.btn .btn-light`) and Confirm action button (`.btn .btn-danger`).

## 7. Global Topbar Header Architecture
The global header is rendered by `views/templet/preloder_topbar_sidebar.ejs` and styled in `public/css/liquid-glass-theme.css`.

### Critical JS Bindings (Do Not Rename or Remove)
* **Theme Toggle**: `id="header_theme_toggle"`, `onclick="window.toggleAppTheme(event)"`, `.mode[data-id="dark"]`, `.lighticon`, `.darkicon`.
* **Language Switcher**: `.more_lang .lang` elements with `data-value`, `data-lang`, and `<input type="hidden" id="hidden_lang">`. Handler in `views/templet/call.ejs`.
* **POS Permission Gate**: `(accessdata?.logas == 'custmor' && accessdata?.roll?.pos?.includes('read')) || (accessdata?.roll?.pos && accessdata.roll.pos.includes('read'))`.
* **Notification Data**: `accessdata.notification_data` (array from `tbl_notification`, LIMIT 5).
* **Store Badge**: `accessdata.topbardata.store_name || accessdata.topbardata.store` (conditional on `accessdata.topbardata.is_staff != 0`).

### Header Component Classes
* `.header-store-badge` / `.header-store-dot` — Live store status frosted pill.
* `.header-pos-btn` — Quick POS action gradient button.
* `.header-icon-btn` — Frosted glass icon container (theme toggle, bell).
* `.header-badge-dot` — Pulsing notification indicator.
* `.notification-glass-menu` / `.lang-glass-menu` / `.profile-glass-menu` — Frosted glass dropdown menus.
* `.notif-item` / `.notif-item-icon` / `.notif-item-body` / `.notif-item-text` / `.notif-item-time` — Notification item layout.
* `.lang-grid` / `.lang-grid-item` — 2-column language selector grid.

## 8. Database Delivery Standards & Staff Authentication Invariants

### A. Staff Authentication & Permission Join Invariant
* In `middelwer/access.js`, permissions are resolved by joining `tbl_staff_roll` on `WHERE sr.id = ${user.roll}`.
* In `routers/login.js`, `user.roll` is populated directly from `tbl_admin.roll_id`.
* **CRITICAL INVARIANT**: `tbl_admin.roll_id` **must always store the Primary Key (`id`) of `tbl_staff_roll`** (never `tbl_roll.id`).
* `tbl_staff_roll.staff_id` links back to `tbl_admin.id`, and `tbl_staff_roll.main_roll_id` links to `tbl_roll.id`.

### B. Standard Main Store Accounts (Password `123456`)
When provisioning a clean delivery database or demo store, maintain these 5 default accounts:
1. **Admin**: `admin` &bull; Role: `Master` (`tbl_roll.id = 12`, `store_ID: ''`, `is_staff: '0'`).
2. **Manager**: `manager` &bull; Role: `Store` (`tbl_roll.id = 13`, `store_ID: '4'`, `is_staff: '0'`).
3. **Order Delete**: `orderdelete` &bull; Role: `Order Delete` (`tbl_roll.id = 15`, `store_ID: '4'`, `is_staff: '1'`).
4. **Cashier**: `cashier` &bull; Role: `Cashier` (`tbl_roll.id = 16`, `store_ID: '4'`, `is_staff: '1'`).
5. **Customer**: `customer` &bull; Table: `tbl_customer` (`store_ID: '4'`, `main_roll_id: 14`).
* *Synchronization Rule*: Whenever default accounts change, always update both the credentials table in `README.md` and the one-click demo pills in `views/login.ejs`.

### C. UTF-8 Database Export Standard on Windows
* ❌ **Never use PowerShell redirection (`> file.sql`)**: Windows PowerShell defaults to UTF-16LE, which corrupts SQL dump imports on Linux, cPanel, and MySQL command line clients.
* ✅ **Always use native `--result-file`**:
  ```powershell
  mysqldump --default-character-set=utf8mb4 --result-file=database/lndry.sql -u root <dbname>
  ```

### D. Clean Delivery Preserved Tables
When truncating transactional tables (`tbl_order`, `tbl_order_payment`, `tbl_cart`, `tbl_customer`, `tbl_expense`, `tbl_transections`, `tbl_notification`), the following core tables must **never** be truncated:
* `tbl_validate`: Required by `app.js` (lines 27–40) for global scripts and verification tokens.
* `tbl_orderstatus`: The 7 system order workflow stages.
* `tbl_roll` & `tbl_staff_roll`: System and role permission maps.
* `tbl_master_shop`: Global branding, currency, timezone, and thermal printer hardware settings.
* `tbl_services_type`, `tbl_services`, `tbl_addons`: Starter laundry/dry cleaning catalog.

## 9. Express Route Response & Error Handling Contract

Every Express route handler must guarantee an HTTP response across every execution branch:
* **AJAX / API Endpoints** (e.g. `/tool/staffroll/:id`, `/tool/rolldetailstaff/:id`):
  ```javascript
  router.post("/status-toggle/:id", auth, async (req, res) => {
    try {
      if (process.env.DISABLE_DB_WRITE === "true") {
        return res.status(403).json({ success: false, message: "Demo mode write disabled" });
      }
      const rawStatus = req.body.status;
      const status = (rawStatus === "active" || rawStatus === "1" || rawStatus === 1 || rawStatus === true) ? "1" : "0";

      const result = await DataUpdate("tbl_admin", `approved='${status}'`, `id='${req.params.id}'`, req.hostname, req.protocol);
      if (result === -1) {
        return res.status(400).json({ success: false, message: "Update failed" });
      }
      return res.status(200).json({ success: true, status });
    } catch (error) {
      console.error("Status update error:", error);
      return res.status(500).json({ success: false, message: "Internal server error" });
    }
  });
  ```
* **Full-Page Form Submissions**:
  Always finish with `req.flash(...)` and `return res.redirect(...)`. Never return hanging promises without response termination.

## 10. Database Boolean Normalization & Status Toggling Standard

* **MySQL Storage**: In this project, status flags (`approved`, `active`, `delet_flage`) are frequently typed as `VARCHAR(45)` storing `'1'` or `'0'`.
* **Comparison in Templates/JS**:
  * ❌ `data === 1` (Fails if data is string `'1'`)
  * ✅ `String(data) === '1'` or `Number(data) === 1` or `data == 1`
* **Controller Normalization**:
  ```javascript
  const status = (raw === "active" || raw === "1" || raw === 1 || raw === true) ? "1" : "0";
  ```

## 11. Modal Dialog Scrolling & Responsive Form Layout Pattern

* **Modal Dialog Architecture**:
  * Always include `.modal-dialog-centered` and `.modal-dialog-scrollable` on modals containing multi-field forms or role permission matrices.
  * Ensures `.modal-header` and `.modal-footer` remain stationary while `.modal-body` scrolls smoothly.
* **Responsive Two-Column Layout**:
  * Use Bootstrap 5 grid: `<div class="row g-3">` with `<div class="col-12 col-md-6">` for fields.
  * Use `<div class="col-12">` for full-width cards (e.g. Active status switch or permission accordions).

