(function () {
  "use strict";

  if ($("#is_pos2").val() !== "1") return;

  const bootstrapData = window.POS2_BOOTSTRAP || {};
  let jobTypeTree = Array.isArray(bootstrapData.jobTypeTree) ? bootstrapData.jobTypeTree : [];
  let activeJobType = bootstrapData.activeJobType || null;
  let activeBreadcrumb = Array.isArray(bootstrapData.activeJobTypeBreadcrumb)
    ? bootstrapData.activeJobTypeBreadcrumb
    : [];
  let pendingSelectedJtId = activeJobType ? Number(activeJobType.id) : null;
  let pendingSwitchClearCart = false;
  let isAddingItem = false;

  const baseUrl = window.location.origin;

  function escapeHtml(str) {
    return String(str || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function formatCurrency(amount) {
    const num = Number(amount || 0);
    const fixed = Number.isFinite(num) ? num.toFixed(2) : "0.00";
    const sym = $('input[name="sym"]').val() || "$";
    const pls = $('input[name="pls"]').val();
    return String(pls) === "1" ? `${fixed} ${sym}` : `${sym}${fixed}`;
  }

  function getActiveCartRowCount() {
    const $rows = $("#POS_service_added_list tr");
    if ($rows.length === 0) return 0;
    if ($("#POS_service_added_list").text().includes("Your cart is empty")) return 0;
    return $rows.length;
  }

  function findJobTypeNodeById(nodes, targetId) {
    const idNum = Number(targetId);
    for (const node of nodes || []) {
      if (Number(node.id) === idNum) return node;
      if (node.children && node.children.length > 0) {
        const found = findJobTypeNodeById(node.children, idNum);
        if (found) return found;
      }
    }
    return null;
  }

  function formatBreadcrumbText(crumbs, fallbackName) {
    if (Array.isArray(crumbs) && crumbs.length > 0) {
      return crumbs.map((c) => c.name).join(" › ");
    }
    return fallbackName || "";
  }

  function updateSelectedPreviewInModal() {
    const $confirmBtn = $("#btnPos2ConfirmJobType");
    const $preview = $("#pos2ModalSelectedPreview");
    const $icon = $("#pos2ModalSelectedIcon");

    const node = pendingSelectedJtId ? findJobTypeNodeById(jobTypeTree, pendingSelectedJtId) : null;
    if (node && Number(node.pricedCount) > 0) {
      const label = formatBreadcrumbText(node.breadcrumb, node.name);
      $preview.text(`${label} (${node.pricedCount} ${node.pricedCount === 1 ? "item" : "items"})`);
      $icon.removeClass("d-none");
      $confirmBtn.prop("disabled", false);
    } else {
      $preview.text("Select a Job Type with priced items");
      $icon.addClass("d-none");
      $confirmBtn.prop("disabled", true);
    }
  }

  function renderJobTypeTreeInModal() {
    const $container = $("#pos2JobTypeTreeContainer");
    const $emptySearch = $("#pos2JobTypeEmptySearch");
    $emptySearch.addClass("d-none");

    const storeVal = $("#pos_store_id").val() || $("#pos_staff_store_id").val() || "0";
    if (!storeVal || storeVal === "0") {
      $container.html(
        '<div class="text-center py-4 border rounded-3 text-muted">' +
          '<i class="fa fa-store fa-2x opacity-50 mb-2 d-block"></i>' +
          '<div class="fw-semibold">Please select a store above to view its Job Types.</div>' +
        "</div>"
      );
      pendingSelectedJtId = null;
      updateSelectedPreviewInModal();
      return;
    }

    if (!jobTypeTree || jobTypeTree.length === 0) {
      $container.html(
        '<div class="text-center py-4 border rounded-3 text-muted">' +
          '<i class="fa fa-sitemap fa-2x opacity-50 mb-2 d-block"></i>' +
          '<div class="fw-semibold mb-1">No Active Job Types Found</div>' +
          '<div class="small mb-3">Create Job Types and configure their item prices to use POS-2.</div>' +
          '<a href="/job-types" class="btn btn-sm btn-primary"><i class="fa fa-cog me-1"></i>Manage Job Types</a>' +
        "</div>"
      );
      pendingSelectedJtId = null;
      updateSelectedPreviewInModal();
      return;
    }

    function buildBranchHtml(nodes, isRoot) {
      let html = `<ul class="${isRoot ? "pos2-jt-list" : "pos2-jt-children"}">`;
      for (const node of nodes) {
        const hasPrices = Number(node.pricedCount) > 0;
        const isSelected = hasPrices && Number(pendingSelectedJtId) === Number(node.id);
        const searchText = escapeHtml(`${node.name || ""} ${node.description || ""}`.toLowerCase());
        const levelBadge =
          node.depth === 0
            ? '<span class="badge bg-primary-subtle text-primary rounded-pill">Job Type</span>'
            : `<span class="badge bg-secondary-subtle text-secondary rounded-pill">Sub-Type</span>`;
        const priceBadge = hasPrices
          ? `<span class="badge bg-success-subtle text-success rounded-pill"><i class="fa fa-tags me-1"></i>${node.pricedCount} ${node.pricedCount === 1 ? "item" : "items"}</span>`
          : '<span class="badge bg-secondary-subtle text-muted rounded-pill">No items priced</span>';

        const thumbHtml = node.image_url
          ? `<img src="${escapeHtml(node.image_url)}" alt="${escapeHtml(node.name)}" class="pos2-jt-thumb" onerror="this.classList.add('d-none'); this.nextElementSibling.classList.remove('d-none');"><span class="pos2-jt-thumb-icon d-none"><i class="fas ${node.depth === 0 ? "fa-folder" : "fa-tag"}"></i></span>`
          : `<span class="pos2-jt-thumb-icon"><i class="fas ${node.depth === 0 ? "fa-folder" : "fa-tag"}"></i></span>`;

        html +=
          `<li class="pos2-jt-item" data-search="${searchText}">` +
          `<button type="button" class="pos2-jt-option ${isSelected ? "is-selected" : ""} ${hasPrices ? "" : "is-disabled"}" ` +
          `data-jt-id="${node.id}" data-has-prices="${hasPrices ? "1" : "0"}" ${hasPrices ? "" : 'disabled aria-disabled="true"'}>` +
          `<div class="d-flex align-items-center gap-2 min-w-0 flex-grow-1 text-start">` +
          thumbHtml +
          `<div class="min-w-0 flex-grow-1">` +
          `<div class="d-flex align-items-center flex-wrap gap-2">` +
          `<span class="fw-bold text-truncate pos2-jt-name">${escapeHtml(node.name)}</span>` +
          levelBadge +
          `</div>` +
          (node.description ? `<div class="small text-muted text-truncate">${escapeHtml(node.description)}</div>` : "") +
          `</div>` +
          `</div>` +
          `<div class="d-flex align-items-center gap-2 flex-shrink-0">` +
          priceBadge +
          `<span class="pos2-jt-check-indicator"><i class="fas fa-check-circle"></i></span>` +
          `</div>` +
          `</button>`;

        if (node.children && node.children.length > 0) {
          html += buildBranchHtml(node.children, false);
        }
        html += "</li>";
      }
      html += "</ul>";
      return html;
    }

    $container.html(buildBranchHtml(jobTypeTree, true));
    updateSelectedPreviewInModal();
  }

  function filterModalJobTypes() {
    const query = ($("#pos2JobTypeSearch").val() || "").trim().toLowerCase();
    const $rootList = $("#pos2JobTypeTreeContainer > .pos2-jt-list");
    if (!$rootList.length) return;

    let visibleRoots = 0;
    function walk($li) {
      const searchData = String($li.attr("data-search") || "");
      const selfMatches = !query || searchData.includes(query);
      let anyChildVisible = false;
      $li.children(".pos2-jt-children").children(".pos2-jt-item").each(function () {
        if (walk($(this))) anyChildVisible = true;
      });
      const show = selfMatches || anyChildVisible;
      $li.toggleClass("d-none", !show);
      return show;
    }

    $rootList.children(".pos2-jt-item").each(function () {
      if (walk($(this))) visibleRoots++;
    });

    $("#pos2JobTypeEmptySearch").toggleClass("d-none", visibleRoots > 0);
  }

  function openJobTypeModal(allowDismiss) {
    const canDismiss = Boolean(allowDismiss && activeJobType && activeJobType.id);
    $("#btnPos2JobTypeModalClose").toggleClass("d-none", !canDismiss);
    $("#btnPos2JobTypeCancel").toggleClass("d-none", !canDismiss);

    const modalEl = document.getElementById("pos2JobTypeModal");
    if (!modalEl) return;

    pendingSelectedJtId = activeJobType ? Number(activeJobType.id) : null;
    $("#pos2JobTypeSearch").val("");
    renderJobTypeTreeInModal();

    const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl, {
      backdrop: "static",
      keyboard: false,
    });
    modalInstance.show();
  }

  function updateActiveJobTypeUI(jt, breadcrumb) {
    activeJobType = jt || null;
    activeBreadcrumb = Array.isArray(breadcrumb) ? breadcrumb : [];

    $("#pos2_active_job_type_id").val(activeJobType ? activeJobType.id : "");

    const $barName = $("#pos2_active_job_type_breadcrumb");
    const $barCount = $("#pos2_active_job_type_count");
    const $barBtnLabel = $("#pos2_change_job_type_label");
    const $cartChip = $("#pos2_cart_job_type_pill");
    const $cartChipText = $("#pos2_cart_job_type_text");

    if (activeJobType) {
      const crumbText = formatBreadcrumbText(activeBreadcrumb, activeJobType.name);
      $barName.text(crumbText);
      const cnt = Number(activeJobType.pricedCount) || 0;
      $barCount
        .text(`${cnt} ${cnt === 1 ? "item" : "items"}`)
        .removeClass("d-none");
      $barBtnLabel.text("Change Job Type");
      if ($cartChip.length) {
        $cartChipText.text(crumbText);
        $cartChip.removeClass("d-none");
      }
    } else {
      $barName.text("No Job Type Selected");
      $barCount.addClass("d-none");
      $barBtnLabel.text("Select Job Type");
      if ($cartChip.length) {
        $cartChip.addClass("d-none");
      }
    }
  }

  function renderPricedServicesGrid(services, posImageSize) {
    const $grid = $("#pos_service");
    const activeSize = posImageSize || $("#pos_image_size").val() || "medium";
    $("#pos_image_size").val(activeSize);
    $grid
      .removeClass("pos-img-size-small pos-img-size-medium pos-img-size-large")
      .addClass("pos-img-size-" + activeSize)
      .html("");

    if (!Array.isArray(services) || services.length === 0) {
      $grid.html(
        '<div class="p-4 text-center w-100 text-muted">' +
          '<i class="fa fa-box-open fa-2x opacity-50 mb-2 d-block"></i>' +
          '<div class="fw-semibold">No priced service items available for this Job Type.</div>' +
        "</div>"
      );
      return;
    }

    const fragment = [];
    for (const svc of services) {
      const priceNum = Number(svc.job_item_price || 0);
      const priceLabel = formatCurrency(priceNum);
      const pcsBadge =
        svc.no_of_items && parseInt(svc.no_of_items, 10) > 1
          ? `<span class="position-absolute top-0 end-0 badge bg-primary text-white m-1 rounded-pill shadow-sm" style="z-index: 2; font-size: 0.7rem;">${parseInt(svc.no_of_items, 10)} Pcs</span>`
          : "";
      const imgUrl =
        svc.pos_image_url || `/uploads/${encodeURIComponent(activeSize)}/${encodeURIComponent(svc.image || "")}`;

      fragment.push(
        `<a href="javascript:void(0)" class="pos-service-item pos2-direct-service text-decoration-none" ` +
          `data-name="${escapeHtml((svc.name || "").toLowerCase())}" ` +
          `data-id="${svc.id}" ` +
          `data-job-price="${priceNum.toFixed(2)}">` +
          `<div class="card h-100 shadow-sm border rounded-3 text-center overflow-hidden pos-service-card position-relative">` +
          pcsBadge +
          `<span class="pos2-card-price-badge">${escapeHtml(priceLabel)}</span>` +
          `<div class="ratio ratio-1x1 bg-light position-relative">` +
          `<img src="${escapeHtml(imgUrl)}" class="card-img-top w-100 h-100 pos-service-img" onerror="this.style.display='none'; this.nextElementSibling.classList.remove('d-none'); this.nextElementSibling.classList.add('d-flex');" alt="${escapeHtml(svc.name)}">` +
          `<div class="pos-service-fallback-icon position-absolute top-0 start-0 w-100 h-100 align-items-center justify-content-center text-primary fs-3 d-none"><i class="fa fa-tshirt"></i></div>` +
          `</div>` +
          `<div class="card-body d-flex align-items-center justify-content-center">` +
          `<h6 class="card-title m-0 fw-bold fs-7 pos-service-name" title="${escapeHtml(svc.name)}">${escapeHtml(svc.name)}</h6>` +
          `</div>` +
          `</div>` +
        `</a>`
      );
    }

    $grid.html(fragment.join(""));
    $("#service_pos_search").val("");
    $("#pos_search_clear").hide();
  }

  function syncCartDisplay(cart, cartservice, loginas) {
    if (!cart) return;

    $("#POS_gross_total").html((Number(cart.gross_total) || 0).toFixed(2));
    $("#POS_sub_total").html((Number(cart.sub_total) || 0).toFixed(2));
    $("#POS_addon_total").html((Number(cart.addon_price) || 0).toFixed(2));
    $("#POS_coupon_total").html((Number(cart.coupon_discount) || 0).toFixed(2));
    $("#POS_tax_total").html((Number(cart.tax_amount) || 0).toFixed(2));

    const list = Array.isArray(cartservice) ? cartservice : [];
    const $tbody = $("#POS_service_added_list");
    $tbody.html("");

    if (list.length > 0) {
      $("#pos_cart_main_table").removeClass("d-none");
      $("#pos_empty_cart_indicator").addClass("d-none");
      $.each(list, function (index, value) {
        if (typeof window.renderPosCartRowHTML === "function") {
          $tbody.append(window.renderPosCartRowHTML(value, false, null, loginas));
        }
      });
      if (loginas == 0 || $("#can_override_pos_price_discount").val() === "0") {
        $("input[name=service_type_price]").prop("readonly", true);
      }
    } else {
      $("#pos_cart_main_table").addClass("d-none");
      $("#pos_empty_cart_indicator").removeClass("d-none");
    }

    $("#posMobileCartBadge").text(list.length);

    if (typeof window.poscurrency === "function") {
      window.poscurrency();
    }
  }

  function confirmSelectedJobType(clearCartFlag) {
    if (!pendingSelectedJtId) return;

    const $btn = $("#btnPos2ConfirmJobType");
    $btn.prop("disabled", true).html('<span class="spinner-border spinner-border-sm me-1"></span>Loading...');

    $.ajax({
      type: "POST",
      url: baseUrl + "/pos-2/select-job-type",
      contentType: "application/json",
      data: JSON.stringify({
        job_type_id: pendingSelectedJtId,
        clear_cart: Boolean(clearCartFlag),
      }),
      dataType: "json",
      success: function (res) {
        if (res && res.success) {
          updateActiveJobTypeUI(res.activeJobType, res.breadcrumb);
          renderPricedServicesGrid(res.service_list, res.pos_image_size);
          if (res.cartCleared && res.cart) {
            syncCartDisplay(res.cart, res.cartservice || [], res.loginas);
            if (typeof window.syncPosAddonsUI === "function") {
              window.syncPosAddonsUI("0", 0, []);
            }
          }
          pendingSwitchClearCart = false;
          const modalEl = document.getElementById("pos2JobTypeModal");
          if (modalEl) {
            const inst = bootstrap.Modal.getInstance(modalEl);
            if (inst) inst.hide();
          }
          if (typeof toastr !== "undefined") {
            toastr.success(
              `Job Type set to ${formatBreadcrumbText(res.breadcrumb, res.activeJobType.name)}`,
              "POS-2"
            );
          }
        } else {
          if (typeof toastr !== "undefined") {
            toastr.error((res && res.message) || "Failed to load Job Type services.");
          }
        }
      },
      error: function (xhr) {
        const resp = xhr && xhr.responseJSON ? xhr.responseJSON : {};
        if (xhr && xhr.status === 409 && resp.requiresClear) {
          // Close picker briefly and prompt confirmation to clear cart
          const pickerEl = document.getElementById("pos2JobTypeModal");
          if (pickerEl) {
            const inst = bootstrap.Modal.getInstance(pickerEl);
            if (inst) inst.hide();
          }
          $("#pos2SwitchCurrentJtName").text(
            formatBreadcrumbText(activeBreadcrumb, activeJobType ? activeJobType.name : "current Job Type")
          );
          const confirmEl = document.getElementById("pos2SwitchJobTypeConfirmModal");
          if (confirmEl) {
            bootstrap.Modal.getOrCreateInstance(confirmEl).show();
          }
          return;
        }
        if (typeof toastr !== "undefined") {
          toastr.error(resp.message || "Error selecting Job Type.");
        }
      },
      complete: function () {
        $btn.prop("disabled", !pendingSelectedJtId).html('<i class="fa fa-check me-1"></i><span>Confirm Job Type</span>');
      },
    });
  }

  function loadStoreContextForPos2(storeId) {
    if (!storeId || storeId === "0") return;

    $("#pos2JobTypeTreeContainer").html(
      '<div class="text-center py-4 text-muted">' +
        '<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>' +
        "<span>Loading store job types...</span>" +
      "</div>"
    );

    // Clear cart & reload store customers, addons, and job types
    $.ajax({
      type: "GET",
      url: baseUrl + "/admin/clearcart",
      dataType: "json",
      complete: function () {
        // Reload customers
        $.ajax({
          type: "GET",
          url: baseUrl + "/admin/customerlist/" + encodeURIComponent(storeId),
          dataType: "json",
          success: function (res) {
            window.POS_CUSTOMER_LIST = res.customerList || [];
            $("#single-select").prop("disabled", false);
            if (!res.customerList || res.customerList.length < 1) {
              $("#single-select").html(
                '<option value="0" selected disabled>No Customers Registered in Selected Store</option>'
              );
            } else {
              $("#single-select").html(
                '<option value="0" ' +
                  (!res.defaultCustomerId ? "selected" : "") +
                  " disabled>Select Customer *</option>"
              );
            }
            $.each(res.customerList || [], function (index, value) {
              const isDefault = res.defaultCustomerId && value.id == res.defaultCustomerId;
              const extra =
                value.username === "" || value.username === null
                  ? value.store_name || ""
                  : value.number || "";
              const extraText = extra ? " (" + extra + ")" : "";
              $("#single-select").append(
                '<option value="' +
                  value.id +
                  '" data-customer-type="' +
                  (value.customer_type || "Counter • Counter") +
                  '" data-address="' +
                  (value.address || "") +
                  '" data-city="' +
                  (value.city || "") +
                  '" data-state="' +
                  (value.state || "") +
                  '" data-zipcode="' +
                  (value.zipcode || "") +
                  '" ' +
                  (isDefault ? "selected" : "") +
                  ">" +
                  escapeHtml(value.name + extraText) +
                  "</option>"
              );
            });
            if (res.defaultCustomerId) {
              $("#single-select").val(res.defaultCustomerId).trigger("change");
            } else {
              $("#single-select").val("0");
            }
            if (typeof window.syncPosCustomerDisplay === "function") {
              window.syncPosCustomerDisplay(res.defaultCustomerId || "0");
            }
            $("#coupon_storlist_update").val(storeId);
          },
        });

        // Reload addons & tax on tbl_cart
        $.ajax({
          type: "GET",
          url: baseUrl + "/admin/addonlist/" + encodeURIComponent(storeId),
          dataType: "json",
          success: function (res) {
            if (res && res.cart) {
              syncCartDisplay(res.cart, [], 1);
              $("#POS_tax_percent").html("TAX (" + (res.cart.tax || 0) + " %):");
            }
            if (res && res.override_rate_percent !== undefined) {
              $("#pos_override_rate_percent").val(res.override_rate_percent);
            }
            if (Array.isArray(res && res.addon_list)) {
              const $addonsBox = $("#POS_addons");
              if (res.addon_list.length < 1) {
                $addonsBox.html(
                  '<div class="p-3 text-center w-100"><h5 class="text-danger">No Addons Available</h5></div>'
                );
              } else {
                const sym = $('input[name="sym"]').val() || "$";
                let addonHtml = "";
                res.addon_list.forEach(function (ad) {
                  const p = (Number(ad.price) || 0).toFixed(2);
                  addonHtml +=
                    '<div class="col-12 col-sm-6">' +
                    '<div class="border rounded-3 p-2.5 d-flex align-items-center justify-content-between gap-2 pos-addon-modal-card">' +
                    '<div class="form-check d-flex align-items-center gap-2 mb-0 flex-grow-1">' +
                    `<input class="form-check-input pos-addon-checkbox" type="checkbox" name="addon" id="addon_${ad.id}" value="${ad.id}">` +
                    `<label class="form-check-label fw-semibold mb-0" for="addon_${ad.id}">${escapeHtml(ad.addon)}</label>` +
                    "</div>" +
                    '<div class="input-group input-group-sm" style="width: 115px;">' +
                    `<span class="input-group-text">${escapeHtml(sym)}</span>` +
                    `<input type="number" class="form-control pos-modal-addon-price text-end" name="addon_price_${ad.id}" data-addon-id="${ad.id}" data-default-price="${p}" value="${p}" min="0" step="0.25">` +
                    "</div>" +
                    "</div>" +
                    "</div>";
                });
                $addonsBox.html(addonHtml);
              }
            }
          },
        });

        // Fetch store's active Job Types
        $.ajax({
          type: "GET",
          url: baseUrl + "/pos-2/job-types/" + encodeURIComponent(storeId),
          dataType: "json",
          success: function (res) {
            jobTypeTree = res && Array.isArray(res.jobTypeTree) ? res.jobTypeTree : [];
            updateActiveJobTypeUI(null, []);
            $("#pos_service").html(
              '<div class="p-4 text-center w-100 text-muted">' +
                '<i class="fa fa-sitemap fa-2x opacity-50 mb-2 d-block"></i>' +
                '<div class="fw-semibold">Select a Job Type to load priced services.</div>' +
              "</div>"
            );
            pendingSelectedJtId = null;
            renderJobTypeTreeInModal();
            const modalEl = document.getElementById("pos2JobTypeModal");
            if (modalEl && !modalEl.classList.contains("show")) {
              openJobTypeModal(false);
            }
          },
          error: function () {
            $("#pos2JobTypeTreeContainer").html(
              '<div class="text-center py-4 text-danger">Failed to load job types for this store.</div>'
            );
          },
        });
      },
    });
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================

  // Modal search
  let jtSearchTimer = null;
  $(document).on("input", "#pos2JobTypeSearch", function () {
    clearTimeout(jtSearchTimer);
    jtSearchTimer = setTimeout(filterModalJobTypes, 120);
  });

  // Select Job Type row inside modal
  $(document).on("click", ".pos2-jt-option:not(.is-disabled)", function () {
    const jtId = Number($(this).attr("data-jt-id"));
    if (!jtId) return;
    pendingSelectedJtId = jtId;
    $("#pos2JobTypeTreeContainer .pos2-jt-option").removeClass("is-selected");
    $(this).addClass("is-selected");
    updateSelectedPreviewInModal();
  });

  // Double-click quick confirm inside modal
  $(document).on("dblclick", ".pos2-jt-option:not(.is-disabled)", function () {
    const jtId = Number($(this).attr("data-jt-id"));
    if (!jtId) return;
    pendingSelectedJtId = jtId;
    confirmSelectedJobType(pendingSwitchClearCart);
  });

  // Confirm Job Type button
  $(document).on("click", "#btnPos2ConfirmJobType", function () {
    confirmSelectedJobType(pendingSwitchClearCart);
  });

  // Change / Select Job Type button on POS-2 screen
  $(document).on("click", "#btn_pos2_change_job_type, #pos2_cart_job_type_pill", function () {
    const hasItems = getActiveCartRowCount() > 0;
    if (hasItems && activeJobType) {
      $("#pos2SwitchCurrentJtName").text(formatBreadcrumbText(activeBreadcrumb, activeJobType.name));
      const confirmEl = document.getElementById("pos2SwitchJobTypeConfirmModal");
      if (confirmEl) {
        bootstrap.Modal.getOrCreateInstance(confirmEl).show();
      }
    } else {
      pendingSwitchClearCart = false;
      openJobTypeModal(Boolean(activeJobType));
    }
  });

  // Confirm clearing cart before switching Job Type
  $(document).on("click", "#btnPos2ConfirmClearAndSwitch", function () {
    const confirmEl = document.getElementById("pos2SwitchJobTypeConfirmModal");
    if (confirmEl) {
      const inst = bootstrap.Modal.getInstance(confirmEl);
      if (inst) inst.hide();
    }
    pendingSwitchClearCart = true;
    setTimeout(function () {
      openJobTypeModal(true);
    }, 220);
  });

  // Store selector sync (Master Admin): inside modal <-> topbar
  $(document).on("change", "#pos2ModalStoreSelect", function () {
    const val = $(this).val();
    if (!val || val === "0") return;
    const $topSelect = $("#pos_store_id");
    if ($topSelect.length && String($topSelect.val()) !== String(val)) {
      $topSelect.val(val);
      if ($topSelect.hasClass("default-select") && typeof $topSelect.selectpicker === "function") {
        $topSelect.selectpicker("refresh");
      }
    }
    loadStoreContextForPos2(val);
  });

  $("body").on("change", "#pos_store_id", function () {
    const val = $(this).val();
    if (!val || val === "0") return;
    const $modalSelect = $("#pos2ModalStoreSelect");
    if ($modalSelect.length && String($modalSelect.val()) !== String(val)) {
      $modalSelect.val(val);
    }
    loadStoreContextForPos2(val);
  });

  // Direct single-click Add to Cart (bypasses Service Type popup completely)
  $(document).on("click", "#pos_service .pos2-direct-service, #pos_service .pos-service-item", function (e) {
    e.preventDefault();
    e.stopPropagation();

    const $card = $(this).closest(".pos-service-item");
    const serviceId = Number($card.attr("data-id"));
    if (!serviceId) return;

    const currentJtId = Number($("#pos2_active_job_type_id").val() || (activeJobType && activeJobType.id) || 0);
    if (!currentJtId) {
      openJobTypeModal(false);
      return;
    }

    if (isAddingItem) return;
    isAddingItem = true;
    $card.addClass("pos2-service-adding");

    $.ajax({
      type: "POST",
      url: baseUrl + "/pos-2/direct-add",
      contentType: "application/json",
      data: JSON.stringify({
        service_id: serviceId,
        job_type_id: currentJtId,
      }),
      dataType: "json",
      success: function (res) {
        if (res && res.success) {
          syncCartDisplay(res.cart, res.cartservice, res.loginas);
          if (typeof toastr !== "undefined" && res.addedItem) {
            toastr.success(
              `Added ${res.addedItem.service_name} (${formatCurrency(res.addedItem.price)})`,
              res.addedItem.job_type_name || "Added to Cart",
              { timeOut: 1400 }
            );
          }
        } else {
          if (typeof toastr !== "undefined") {
            toastr.error((res && res.message) || "Could not add item to cart.");
          }
        }
      },
      error: function (xhr) {
        const msg =
          xhr && xhr.responseJSON && xhr.responseJSON.message
            ? xhr.responseJSON.message
            : "Error adding service item.";
        if (typeof toastr !== "undefined") {
          toastr.error(msg);
        }
      },
      complete: function () {
        isAddingItem = false;
        setTimeout(function () {
          $card.removeClass("pos2-service-adding");
        }, 180);
      },
    });
  });

  // Auto-open Job Type modal on POS-2 load when fresh / empty cart
  $(document).ready(function () {
    if (bootstrapData.shouldOpenJobTypeModal) {
      openJobTypeModal(Boolean(activeJobType && activeJobType.id));
    }
  });
})();
