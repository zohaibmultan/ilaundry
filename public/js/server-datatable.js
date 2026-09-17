/**
 * UNIFIED SERVER-SIDE DATATABLES CLIENT HELPER
 * Provides standardized initialization, debounce searching, and filter toolbar integration.
 */
(function(window, $) {
    "use strict";

    // Set DataTables to log errors to console rather than displaying alert modals
    if ($ && $.fn && $.fn.dataTable && $.fn.dataTable.ext) {
        $.fn.dataTable.ext.errMode = 'console';
    }

    /**
     * Standard currency formatter for DataTables columns
     * Uses currency symbol from <input name="sym"> with fallback.
     */
    function formatDtCurrency(val) {
        if (val === undefined || val === null || val === '') return '—';
        var sym = $('input[name=sym]').val() || '';
        var num = parseFloat(val);
        if (isNaN(num)) return val;
        return sym + num.toFixed(2);
    }
    window.formatDtCurrency = formatDtCurrency;

    /**
     * Safe HTML escaper for cell rendering
     */
    if (typeof window.escapeHtml !== 'function') {
        window.escapeHtml = function(str) {
            if (!str && str !== 0) return '';
            return String(str)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        };
    }

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
                    // Extract filter mappings from filterSelectors or filterElements
                    var filterMap = options.filterSelectors || options.filterElements || {};
                    for (var key in filterMap) {
                        if (filterMap.hasOwnProperty(key)) {
                            var sel = filterMap[key];
                            if (sel) {
                                var fVal = $(sel).val();
                                if (fVal !== undefined && fVal !== null && fVal !== '') {
                                    d[key] = fVal;
                                }
                            }
                        }
                    }

                    // Merge custom getFilters if provided
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

        // Bind Filter Inputs / Selects automatically
        var allFilterSelectors = [];
        if (options.filterInputs) {
            allFilterSelectors.push(options.filterInputs);
        }
        var filterMap = options.filterSelectors || options.filterElements || {};
        for (var fk in filterMap) {
            if (filterMap.hasOwnProperty(fk) && filterMap[fk]) {
                allFilterSelectors.push(filterMap[fk]);
            }
        }

        if (allFilterSelectors.length > 0) {
            var combinedFilterSelector = allFilterSelectors.join(', ');
            $(document).off('change.serverDtFilter', combinedFilterSelector)
                       .on('change.serverDtFilter', combinedFilterSelector, function() {
                dataTable.ajax.reload();
            });
        }

        return dataTable;
    }

    window.initServerDataTable = initServerDataTable;

})(window, jQuery);
