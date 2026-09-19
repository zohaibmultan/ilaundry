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

