---
name: server-datatables
description: >-
  Standardized Server-Side DataTables pattern for iLaundry.
  Includes backend pagination/filtering protocol, 400ms search debounce,
  and uniform CSS classes for badges and action icons.
---

# Server-Side DataTables Workflow & Pattern

This skill documents the standard architecture for tabular data views across all iLaundry modules.

## Architecture

1. **Backend Route**:
   - `GET /<module>/data` with auth middleware.
   - Parses query parameters:
     - `draw`: Sequence number (returned back in JSON).
     - `start`: SQL offset.
     - `length`: SQL limit.
     - `search[value]`: Search term.
     - `order[0][column]`: Column index.
     - `order[0][dir]`: Sort direction (`asc` / `desc`).
   - Executes two queries:
     1. Total records count (`recordsTotal` and `recordsFiltered`).
     2. Page data query with `LIMIT ?, ?`.
   - Returns:
     ```json
     {
       "draw": 1,
       "recordsTotal": 150,
       "recordsFiltered": 42,
       "data": [ ... ]
     }
     ```

2. **Frontend Initialization**:
   - Always debounce search by **400ms** to avoid MySQL saturation.
   - Use unified CSS classes:
     - Badge status: `.badge-status-pill` + `.status-pending` / `.status-completed` / `.status-delivered` / `.status-cancelled`.
     - Action toolbar: `.server-dt-actions` with `.btn-dt-action` (`.btn-view`, `.btn-edit`, `.btn-print`, `.btn-delete`).

## Examples
- See the complete JavaScript template in [datatable-sample.js](./examples/datatable-sample.js).
