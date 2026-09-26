---
name: server-datatables
description: >-
  Standardized Server-Side DataTables pattern for iCleaners.
  Includes backend pagination/filtering protocol, 400ms search debounce,
  and uniform CSS classes for badges and action icons.
---

# Server-Side DataTables Workflow & Pattern

This skill documents the standard architecture for tabular data views across all iCleaners modules.

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

## 3. Row Action Modals & Form Action Safety Pattern

When DataTables action buttons trigger dynamic editing/updating modals:

### A. Action Button Column Render
* Never repeat IDs across table rows (e.g. ❌ `id="update_staff"`). Always use action classes (e.g. `.btn-staff-edit`).
* Escape dynamic values embedded into data attributes:
  ```javascript
  {
      data: null,
      orderable: false,
      searchable: false,
      className: 'text-center',
      render: function(data, type, row) {
          return `
              <div class="tbl-action-group justify-content-center">
                  <a href="#" class="btn-dt-action btn-edit btn-staff-edit" 
                     data-bs-toggle="modal" data-bs-target="#staff_update"
                     data-id="${row.id}" data-name="${escapeHtml(row.name)}"
                     data-store-id="${row.store_ID}" data-approved="${row.approved}">
                     <i class="fas fa-pencil-alt"></i>
                  </a>
              </div>
          `;
      }
  }
  ```

### B. Dual-Bound Modal Population & Switch Setting
```javascript
function populateUpdateModal(button) {
    const $btn = $(button);
    const id = $btn.attr('data-id');
    const name = $btn.attr('data-name') || '';
    const storeId = $btn.attr('data-store-id') || '';
    const approved = $btn.attr('data-approved');

    if (id) {
        $('#update_form').attr('action', '/module/update/' + id);
    }
    $('#name_update').val(name);
    $('#store_update').val(storeId);
    // Use .prop('checked', boolean), never .attr('checked')
    $('#active_update').prop('checked', String(approved) === '1');
}

// Bind to both direct click and Bootstrap modal show event
$(document).on('click', '.btn-staff-edit', function () {
    populateUpdateModal(this);
});

$('#staff_update').on('show.bs.modal', function (e) {
    if (e.relatedTarget) {
        populateUpdateModal(e.relatedTarget);
    }
});
```

### C. Form Destination Guard
Prevent accidental full-page navigation to empty actions or `undefined`:
```javascript
$('#update_form').on('submit', function (e) {
    const action = $(this).attr('action');
    if (!action || action === '' || action.includes('undefined')) {
        e.preventDefault();
        alert('Invalid destination: please re-open the dialog and try again.');
        return false;
    }
});
```


