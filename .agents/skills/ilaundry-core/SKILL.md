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
