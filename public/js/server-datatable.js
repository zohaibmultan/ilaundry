/**
 * UNIFIED SERVER-SIDE DATATABLES CLIENT HELPER
 * Provides standardized initialization, debounce searching, and filter toolbar integration.
 */
(function(window, $) {
    "use strict";

    function initServerDataTable(selector, options) {
        var $table = $(selector);
        if (!$table.length) return null;

        // Wrap table in styling container if not already wrapped
        if (!$table.closest('.server-datatable-wrapper').length) {
            $table.wrap('<div class="server-datatable-wrapper"></div>');
        }

        var defaultOptions = {
            serverSide: true,
            processing: true,
            autoWidth: false,
            responsive: true,
            pageLength: 10,
            dom: 't<"server-dt-footer"ip>',
            language: {
                processing: '<div class="d-flex align-items-center gap-2"><span class="spinner-border spinner-border-sm text-primary" role="status"></span> <span>Loading data...</span></div>',
                lengthMenu: 'Show _MENU_ entries',
                info: 'Showing <b>_START_</b> to <b>_END_</b> of <b>_TOTAL_</b> entries',
                infoEmpty: 'Showing 0 to 0 of 0 entries',
                infoFiltered: '(filtered from _MAX_ total records)',
                emptyTable: '<div class="py-4 text-center text-muted"><i class="fa fa-folder-open-o fs-2 mb-2 d-block opacity-50"></i>No records found</div>',
                zeroRecords: '<div class="py-4 text-center text-muted"><i class="fa fa-search fs-2 mb-2 d-block opacity-50"></i>No matching records found</div>',
                paginate: {
                    first: '<i class="fa fa-angle-double-left"></i>',
                    last: '<i class="fa fa-angle-double-right"></i>',
                    previous: '<i class="fa fa-angle-left"></i>',
                    next: '<i class="fa fa-angle-right"></i>'
                }
            },
            ajax: {
                url: options.ajaxUrl,
                type: 'GET',
                data: function(d) {
                    if (typeof options.getFilters === 'function') {
                        var customFilters = options.getFilters();
                        $.extend(d, customFilters);
                    }
                },
                error: function(xhr, error, thrown) {
                    console.error('DataTable error on ' + selector + ':', error, thrown);
                }
            },
            drawCallback: function(settings) {
                // Update currency symbols if available
                if (typeof window.currency === 'function') {
                    window.currency();
                } else if (typeof window.forcurrency === 'function') {
                    window.forcurrency();
                }

                // If symbol input exists, format .symbol cells
                var sym = $('input[name=sym]').val();
                if (sym) {
                    $table.find('.symbol').each(function() {
                        var text = $(this).text().trim();
                        if (text && !text.startsWith(sym)) {
                            var clean = text.replace(/[^\d.-]/g, '');
                            var val = parseFloat(clean);
                            if (!isNaN(val)) {
                                $(this).text(sym + val.toFixed(2));
                            }
                        }
                    });
                }

                if (typeof options.onDraw === 'function') {
                    options.onDraw(settings);
                }
            }
        };

        var finalConfig = $.extend(true, {}, defaultOptions, options);
        var dataTable = $table.DataTable(finalConfig);

        // Bind Search Input with 350ms debounce
        if (options.searchInput) {
            var searchTimer = null;
            $(document).on('input keyup', options.searchInput, function(e) {
                var val = $(this).val();
                if (e.which === 13) {
                    clearTimeout(searchTimer);
                    dataTable.search(val).draw();
                    return;
                }
                clearTimeout(searchTimer);
                searchTimer = setTimeout(function() {
                    dataTable.search(val).draw();
                }, 350);
            });
        }

        // Bind Page Length Selector if external
        if (options.pageLengthSelect) {
            $(document).on('change', options.pageLengthSelect, function() {
                var len = parseInt($(this).val()) || 10;
                dataTable.page.len(len).draw();
            });
        }

        // Bind Filter Inputs / Selects
        if (options.filterInputs) {
            $(document).on('change', options.filterInputs, function() {
                dataTable.ajax.reload();
            });
        }

        return dataTable;
    }

    window.initServerDataTable = initServerDataTable;

})(window, jQuery);
