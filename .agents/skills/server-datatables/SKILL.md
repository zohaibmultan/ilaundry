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

2. **Frontend Initialization & Filter UI**:
   - Always debounce search by **400ms** to avoid MySQL saturation.
   - Filter UI must **purely use standard Bootstrap grid and classes** (`row g-2 mb-3`, `col-*`, `input-group`, `form-control`, `form-select`).
   - Use unified CSS classes for table cells:
     - Badge status: `.badge-status-pill` + `.status-pending` / `.status-completed` / `.status-delivered` / `.status-cancelled`.
     - Action toolbar: `.server-dt-actions` with `.btn-dt-action` (`.btn-view`, `.btn-edit`, `.btn-print`, `.btn-delete`).

### Canonical Bootstrap Filter Grid:
```html
<div class="row g-2 mb-3">
    <div class="col-12 col-md-6 col-lg-4">
        <div class="input-group">
            <span class="input-group-text bg-white"><i class="fa fa-search text-muted"></i></span>
            <input class="form-control" type="search" id="dtSearch" placeholder="Search records...">
        </div>
    </div>
    <div class="col-12 col-sm-6 col-md-3 col-lg-3">
        <select class="form-select" id="dtStatus">
            <option value="all">All Status</option>
            <option value="1">Active</option>
            <option value="0">Deactive</option>
        </select>
    </div>
    <div class="col-12 col-sm-6 col-md-3 col-lg-2">
        <select class="form-select" id="dtPageLength">
            <option value="10">10 entries</option>
            <option value="25">25 entries</option>
            <option value="50">50 entries</option>
            <option value="100">100 entries</option>
        </select>
    </div>
</div>
```

## Examples
- See the complete JavaScript template in [datatable-sample.js](./examples/datatable-sample.js).

