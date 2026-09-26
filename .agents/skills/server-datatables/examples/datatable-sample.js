$(document).ready(function () {
  const table = $('#sampleTable').DataTable({
    processing: true,
    serverSide: true,
    autoWidth: false,
    pageLength: 10,
    lengthMenu: [
      [10, 25, 50, 100],
      [10, 25, 50, 100],
    ],
    language: {
      search: "",
      searchPlaceholder: "Search records...",
      processing: '<div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div>',
    },
    ajax: {
      url: '/admin/sample/data',
      type: 'GET',
      data: function (d) {
        // Append any custom filter dropdowns
        d.filter_status = $('#status_filter').val();
        d.filter_store = $('#store_filter').val();
      },
    },
    columns: [
      {
        data: null,
        orderable: false,
        className: 'text-center',
        render: function (data, type, row, meta) {
          return meta.row + meta.settings._iDisplayStart + 1;
        },
      },
      { data: 'code', className: 'fw-bold' },
      { data: 'name' },
      {
        data: 'status',
        render: function (data, type, row) {
          const cls = data === 'Active' ? 'status-completed' : 'status-pending';
          return `<span class="badge-status-pill ${cls}">${data}</span>`;
        },
      },
      {
        data: 'id',
        orderable: false,
        className: 'text-center',
        render: function (data) {
          return `
            <div class="server-dt-actions justify-content-center">
              <a href="/admin/sample/view/${data}" class="btn-dt-action btn-view" title="View"><i class="fa fa-eye"></i></a>
              <a href="/admin/sample/edit/${data}" class="btn-dt-action btn-edit" title="Edit"><i class="fas fa-pencil-alt"></i></a>
              <button type="button" class="btn-dt-action btn-delete" onclick="deleteItem(${data})" title="Delete"><i class="fa fa-trash"></i></button>
            </div>
          `;
        },
      },
    ],
    order: [[1, 'desc']],
  });

  // Debounce search input (400ms)
  let searchTimeout = null;
  $('#sampleTable_filter input').unbind().bind('input', function () {
    const val = this.value;
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(function () {
      table.search(val).draw();
    }, 400);
  });
});
