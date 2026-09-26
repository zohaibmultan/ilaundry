---
name: report-ui
description: >-
  Standardized UI/UX pattern for all iCleaners report pages. Covers the
  unified header card, filter bar, KPI metric cards, detailed breakdown
  table, and AJAX data refresh architecture.
---

# Report Page UI/UX Architecture

All report pages (Daily, Sales, Expense, Tax, Order, Profit & Loss) follow this standardized layout pattern. Any new report page MUST follow this same blueprint.

## Layout Blueprint

### 1. Page Header Card
- Bootstrap `.card` with `.card-header`:
  - `<h3>` with Font Awesome icon (e.g. `fa-calendar-day`, `fa-chart-bar`) + page title.
  - Subtitle `<small class="text-muted">`.
  - Action button(s) on the right (Print, Export): `.btn .btn-sm .btn-outline-secondary`.

### 2. Filter Bar (Inside Same Card)
- Bootstrap grid `.row .g-2 .g-lg-3 .mb-3`:
  - Date input(s): `<input type="date" class="form-control">`.
  - Store selector: `<select class="default-select form-control wide w-100" data-width="100%">` with `bootstrap-select`.
- **Z-Index Rule**: Filter section must have `z-index: 1050` to prevent dropdown from rendering behind sibling cards. Never wrap in a separate card with `backdrop-filter`.

### 3. KPI Metric Summary Cards (3–5 Cards)
- Bootstrap `.row .g-3`:
  - Each card: `.col-12 .col-sm-6 .col-xl-*` → `.daily-kpi-card .rounded-3 .p-3`:
    - Icon circle: `.daily-metric-icon .icon-*` (dedicated color per metric type).
    - Value: `<h4 class="fw-bold mb-0 symbol">` with `id` attribute for AJAX update.
    - Label: `<div class="text-muted fs-12">`.
  - Keep `z-index: 1` on the KPI row so dropdowns from the filter bar layer above.

### 4. Detailed Breakdown Table
- Bootstrap `.card` → `.card-body` → `.table-responsive`:
  - Striped table with icon, category badge (`.daily-badge`), description, and right-aligned monospace amount:
    ```html
    <td class="text-end font-monospace fw-bold fs-6">
      <span class="symbol" id="daily_report_totalsale">0</span>
    </td>
    ```
  - DOM IDs on value cells for AJAX updates by `call.ejs` report functions.

### 5. AJAX Data Refresh
- Report functions (e.g. `dailyorder(date, store)`) in `views/templet/call.ejs` POST to API endpoints and update DOM IDs with returned JSON values.
- KPI cards sync with table values via `MutationObserver` on the value cells (if KPI cards are separate from the table).

## Print Stylesheet
Every report page should include:
```html
<button onclick="window.print()" class="btn btn-sm btn-outline-secondary">
  <i class="fa fa-print me-1"></i> Print
</button>
```
With `@media print` rules hiding sidebar, header navigation, filter controls, and action buttons for a clean single-page output.

## Currency Formatting
- Always add class `symbol` to monetary value elements.
- The global currency formatter in `call.ejs` automatically prepends/appends the store's currency symbol and applies thousands separators.

## Established Report DOM ID Patterns
| Report | Key DOM IDs |
|--------|-------------|
| Daily | `daily_report_orders`, `daily_report_ordersdelivery`, `daily_report_totalsale`, `daily_report_payment`, `daily_report_expence` |
| Sales | `sales_report_totalsale`, `sales_report_discount`, `sales_report_payment`, `sales_report_outstanding` |
| Order | DataTables server-side (no static DOM IDs) |
| Expense | `expence_report_data` (table body populated via AJAX loop) |
| Tax | `tax_report_data` (table body populated via AJAX loop) |
| Profit & Loss | `pl_total_sales`, `pl_total_expense`, `pl_net_profit` |

## Reference Implementations
- Daily Report: [`views/daily_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/daily_report.ejs)
- Order Report: [`views/order_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/order_report.ejs)
- Sales Report: [`views/Sales_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/Sales_report.ejs)
- Expense Report: [`views/Expence_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/Expence_report.ejs)
- Tax Report: [`views/tax_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/tax_report.ejs)
- Profit & Loss: [`views/profit_loss_report.ejs`](file:///e:/Products/Laragon_Laundary/www/views/profit_loss_report.ejs)
