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

        if (options.rowReorder && $.fn.dataTable && $.fn.dataTable.RowReorder) {
            defaultOptions.rowReorder = {
                selector: options.rowReorder.selector || '.reorder-drag-handle',
                dataSrc: options.rowReorder.dataSrc || 'sequence_no',
                update: false
            };
        }

        var finalConfig = $.extend(true, {}, defaultOptions, options);
        var dataTable = $table.DataTable(finalConfig);

        // Bind RowReorder event if enabled
        if (options.rowReorder && $.fn.dataTable && $.fn.dataTable.RowReorder) {
            var reorderEntity = options.rowReorder.entity || 'service';
            var reorderUrl = options.rowReorder.url || '/services/reorder_sequence';

            dataTable.on('row-reorder', function (e, diff, edit) {
                if (!diff || diff.length === 0) return;
                var reorderList = [];
                for (var i = 0; i < diff.length; i++) {
                    var rData = dataTable.row(diff[i].node).data();
                    if (rData && rData.id) {
                        reorderList.push({
                            id: rData.id,
                            sequence_no: parseInt(diff[i].newData, 10)
                        });
                    }
                }

                // If duplicate or missing sequence numbers exist in diff, recalculate from DOM order
                var hasInvalid = false;
                var seenSeq = {};
                for (var j = 0; j < reorderList.length; j++) {
                    var s = reorderList[j].sequence_no;
                    if (s === undefined || s === null || isNaN(s) || seenSeq[s]) {
                        hasInvalid = true;
                        break;
                    }
                    seenSeq[s] = true;
                }

                if (hasInvalid || reorderList.length === 0) {
                    reorderList = [];
                    var pageStart = (dataTable.page.info && dataTable.page.info().start) || 0;
                    $table.find('tbody tr').each(function (idx) {
                        var rData = dataTable.row(this).data();
                        if (rData && rData.id) {
                            reorderList.push({
                                id: rData.id,
                                sequence_no: pageStart + idx + 1
                            });
                        }
                    });
                }

                if (reorderList.length > 0) {
                    $.ajax({
                        url: reorderUrl,
                        type: 'POST',
                        contentType: 'application/json',
                        data: JSON.stringify({
                            action: 'drag_reorder',
                            entity: reorderEntity,
                            reorderList: reorderList
                        }),
                        success: function (res) {
                            if (typeof toastr !== 'undefined') {
                                toastr.success('Sequence reordered successfully');
                            }
                            dataTable.ajax.reload(null, false);
                        },
                        error: function (xhr) {
                            var errMsg = 'Failed to reorder sequence';
                            if (xhr.responseJSON && xhr.responseJSON.message) {
                                errMsg += ': ' + xhr.responseJSON.message;
                            }
                            if (typeof toastr !== 'undefined') {
                                toastr.error(errMsg);
                            }
                            dataTable.ajax.reload(null, false);
                        }
                    });
                }
            });
        }

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

    // Global "Move Position" Dialog for Cross-Page Reordering (e.g. Page 3 to Page 1)
    function ensureMovePositionModal() {
        if ($('#modalMoveSequencePosition').length) return;
        var modalHtml = [
            '<div class="modal fade" id="modalMoveSequencePosition" tabindex="-1" aria-hidden="true" style="z-index: 1065;">',
            '  <div class="modal-dialog modal-dialog-centered modal-sm">',
            '    <div class="modal-content shadow-lg border-0 rounded-4">',
            '      <div class="modal-header border-bottom py-2 px-3">',
            '        <h6 class="modal-title fw-bold text-dark d-flex align-items-center mb-0">',
            '          <i class="fas fa-sort-numeric-down text-primary me-2"></i> Move Position',
            '        </h6>',
            '        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>',
            '      </div>',
            '      <div class="modal-body p-3">',
            '        <div class="text-center mb-3">',
            '          <div class="text-muted small">Moving item</div>',
            '          <div class="fw-bold fs-6 text-dark text-truncate px-2" id="moveItemTitle">Item</div>',
            '          <div class="badge bg-light text-secondary border mt-1 px-2 py-1">Current Position: #<span id="moveCurrentPos">1</span></div>',
            '        </div>',
            '        <div class="d-grid gap-2 mb-3">',
            '          <button type="button" class="btn btn-outline-primary btn-sm rounded-pill fw-semibold btn-quick-move" data-pos="top">',
            '            <i class="fas fa-arrow-up me-1"></i> Move to Top (Page 1, #1)',
            '          </button>',
            '          <button type="button" class="btn btn-outline-secondary btn-sm rounded-pill fw-semibold btn-quick-move" data-pos="bottom">',
            '            <i class="fas fa-arrow-down me-1"></i> Move to Bottom',
            '          </button>',
            '        </div>',
            '        <div class="border-top pt-2">',
            '          <label class="form-label small fw-bold text-muted mb-1">Or Enter Exact Position #</label>',
            '          <div class="input-group input-group-sm">',
            '            <span class="input-group-text bg-white"><i class="fas fa-hashtag text-muted"></i></span>',
            '            <input type="number" class="form-control" id="moveTargetPosInput" min="1" step="1" placeholder="e.g. 1">',
            '            <button class="btn btn-primary btn-apply-move" type="button">',
            '              <i class="fas fa-check me-1"></i> Move',
            '            </button>',
            '          </div>',
            '        </div>',
            '      </div>',
            '    </div>',
            '  </div>',
            '</div>'
        ].join('\n');
        $('body').append(modalHtml);
    }

    var activeMoveContext = null;

    $(document).on('click', '.btn-move-sequence', function (e) {
        e.preventDefault();
        ensureMovePositionModal();
        var $btn = $(this);
        activeMoveContext = {
            id: $btn.attr('data-id'),
            name: $btn.attr('data-name') || 'Item #' + $btn.attr('data-id'),
            seq: $btn.attr('data-seq') || '1',
            entity: $btn.attr('data-entity') || 'service',
            tableSelector: $btn.closest('table').attr('id') ? '#' + $btn.closest('table').attr('id') : null
        };
        $('#moveItemTitle').text(activeMoveContext.name);
        $('#moveCurrentPos').text(activeMoveContext.seq);
        $('#moveTargetPosInput').val('');
        var modalEl = document.getElementById('modalMoveSequencePosition');
        var modal = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modal.show();
    });

    function submitMovePosition(targetPos) {
        if (!activeMoveContext || !activeMoveContext.id) return;
        var tableSelector = activeMoveContext.tableSelector;
        var dataTable = tableSelector ? $(tableSelector).DataTable() : null;
        var pageLen = dataTable ? dataTable.page.len() : 10;

        $.ajax({
            url: '/services/reorder_sequence',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify({
                action: 'move_to_position',
                entity: activeMoveContext.entity,
                id: activeMoveContext.id,
                target_position: targetPos,
                page_length: pageLen
            }),
            success: function (res) {
                var modalEl = document.getElementById('modalMoveSequencePosition');
                var modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();

                if (typeof toastr !== 'undefined') {
                    toastr.success(res.message || 'Item moved successfully');
                }

                if (dataTable) {
                    if (res.targetPage !== undefined && res.targetPage !== null) {
                        dataTable.page(res.targetPage).draw('page');
                    } else {
                        dataTable.ajax.reload(null, false);
                    }
                }
            },
            error: function (xhr) {
                var msg = 'Failed to move position';
                try {
                    var parsed = JSON.parse(xhr.responseText);
                    if (parsed && parsed.message) msg = parsed.message;
                } catch(e) {}
                if (typeof toastr !== 'undefined') {
                    toastr.error(msg);
                }
            }
        });
    }

    $(document).on('click', '.btn-quick-move', function () {
        var pos = $(this).attr('data-pos');
        submitMovePosition(pos);
    });

    $(document).on('click', '.btn-apply-move', function () {
        var pos = $('#moveTargetPosInput').val();
        if (!pos || parseInt(pos) < 1) {
            alert('Please enter a valid positive position number.');
            return;
        }
        submitMovePosition(parseInt(pos));
    });

    $(document).on('keypress', '#moveTargetPosInput', function (e) {
        if (e.which === 13) {
            $('.btn-apply-move').trigger('click');
        }
    });

    window.initServerDataTable = initServerDataTable;

})(window, jQuery);
