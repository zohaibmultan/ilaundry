(function () {
  "use strict";

  if ($("#is_pos2").val() !== "1") return;

  const bootstrapData = window.POS2_BOOTSTRAP || {};
  let jobTypeTree = Array.isArray(bootstrapData.jobTypeTree) ? bootstrapData.jobTypeTree : [];
  let activeJobType = bootstrapData.activeJobType || null;
  let activeBreadcrumb = Array.isArray(bootstrapData.activeJobTypeBreadcrumb)
    ? bootstrapData.activeJobTypeBreadcrumb
    : [];

  // Two-section modal state (always starts unselected when opened)
  let activeParentJtId = null;
  let pendingSelectedJtId = null;
  let pendingSwitchClearCart = false;
  let isAddingItem = false;
  let posBeepAudioCtx = null;

  function ensureBeepAudioContext() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      if (!posBeepAudioCtx) {
        posBeepAudioCtx = new AudioCtx();
      }
      if (posBeepAudioCtx.state === "suspended") {
        posBeepAudioCtx.resume().catch(function () {});
      }
      return posBeepAudioCtx;
    } catch (_) {
      return null;
    }
  }

  function playPosCartBeep() {
    try {
      const ctx = ensureBeepAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now); // Crisp, pleasant POS beep (C6)
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.14, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.09);
    } catch (_) {
      // Silently ignore if browser audio is blocked or unavailable
    }
  }
  window.playPosCartBeep = playPosCartBeep;

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

  function findRootParentForNode(targetId) {
    const idNum = Number(targetId);
    for (const root of jobTypeTree || []) {
      if (Number(root.id) === idNum) return root;
      if (findJobTypeNodeById(root.children, idNum)) return root;
    }
    return null;
  }

  function collectSubTypes(parentNode) {
    const list = [];
    function walk(nodes, trail) {
      for (const n of nodes || []) {
        list.push({
          node: n,
          subTrail: trail,
        });
        if (n.children && n.children.length > 0) {
          walk(n.children, trail ? `${trail} › ${n.name}` : n.name);
        }
      }
    }
    walk(parentNode && parentNode.children ? parentNode.children : [], "");
    return list;
  }

  function hasPricedDescendant(node) {
    for (const child of (node && node.children) || []) {
      if (Number(child.pricedCount) > 0 || hasPricedDescendant(child)) return true;
    }
    return false;
  }

  function resolveJobTypeFallbackIcon(name, isSubType) {
    const lower = String(name || "").toLowerCase();
    if (lower.includes("tailor") || lower.includes("hem") || lower.includes("sleeve") || lower.includes("sew") || lower.includes("mend") || lower.includes("patch") || lower.includes("lining") || lower.includes("zipper") || lower.includes("button") || lower.includes("hook")) {
      return "fa-cut";
    }
    if (lower.includes("shoe") || lower.includes("sneaker") || lower.includes("ugg") || lower.includes("boot")) {
      return "fa-shoe-prints";
    }
    if (lower.includes("handbag") || lower.includes("bag") || lower.includes("leather") || lower.includes("suede")) {
      return "fa-briefcase";
    }
    if (lower.includes("green") || lower.includes("eco") || lower.includes("organic")) {
      return "fa-leaf";
    }
    if (lower.includes("wet") || lower.includes("steam") || lower.includes("wash") || lower.includes("laundry")) {
      return "fa-tint";
    }
    if (lower.includes("comforter") || lower.includes("bed") || lower.includes("blanket")) {
      return "fa-bed";
    }
    if (lower.includes("dry") || lower.includes("press") || lower.includes("shirt") || lower.includes("garment") || lower.includes("salon")) {
      return "fa-tshirt";
    }
    if (lower.includes("iclean") || lower.includes("cleanique") || lower.includes("express")) {
      return "fa-star";
    }
    return isSubType ? "fa-tag" : "fa-layer-group";
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
    } else if (activeParentJtId) {
      const parentNode = findJobTypeNodeById(jobTypeTree, activeParentJtId);
      const pName = parentNode ? parentNode.name : "this Job Type";
      $preview.text(`Select a Sub Type under ${pName}`);
      $icon.addClass("d-none");
      $confirmBtn.prop("disabled", true);
    } else {
      $preview.text("Select a Job Type or Sub Type");
      $icon.addClass("d-none");
      $confirmBtn.prop("disabled", true);
    }
  }

  function updateSliderArrowStates() {
    const track = document.getElementById("pos2ParentSliderTrack");
    const $prev = $("#btnPos2SliderPrev");
    const $next = $("#btnPos2SliderNext");
    if (!track) return;

    const maxScroll = Math.max(0, track.scrollWidth - track.clientWidth);
    const hasOverflow = maxScroll > 4;
    $prev.prop("disabled", !hasOverflow || track.scrollLeft <= 2);
    $next.prop("disabled", !hasOverflow || track.scrollLeft >= maxScroll - 2);
  }

  function buildTileInnerHtml(node, isSubType, extraMetaBadgeHtml) {
    const hasPrices = Number(node.pricedCount) > 0;
    const fallbackIcon = resolveJobTypeFallbackIcon(node.name, isSubType);
    const mediaHtml = node.image_url
      ? `<div class="pos2-jt-tile-media">` +
          `<img src="${escapeHtml(node.image_url)}" alt="${escapeHtml(node.name)}" class="pos2-jt-tile-img" onerror="this.classList.add('d-none'); this.nextElementSibling.classList.remove('d-none');">` +
          `<span class="pos2-jt-tile-icon d-none"><i class="fas ${fallbackIcon}"></i></span>` +
        `</div>`
      : `<div class="pos2-jt-tile-media"><span class="pos2-jt-tile-icon"><i class="fas ${fallbackIcon}"></i></span></div>`;

    const countBadge = hasPrices
      ? `<span class="badge bg-success-subtle text-success rounded-pill pos2-jt-tile-badge">${node.pricedCount} ${node.pricedCount === 1 ? "item" : "items"}</span>`
      : `<span class="badge bg-secondary-subtle text-muted rounded-pill pos2-jt-tile-badge">No items</span>`;

    return (
      `<span class="pos2-jt-tile-check" aria-hidden="true"><i class="fas fa-check-circle"></i></span>` +
      mediaHtml +
      `<div class="pos2-jt-tile-title" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</div>` +
      `<div class="d-flex align-items-center justify-content-center flex-wrap gap-1 mt-auto">` +
      `</div>`
    );
  }

  function renderParentJobTypesSection() {
    const $track = $("#pos2ParentSliderTrack");
    const storeVal = $("#pos_store_id").val() || $("#pos_staff_store_id").val() || "0";

    if (!storeVal || storeVal === "0") {
      $track.html(
        '<div class="text-center py-4 text-muted w-100" style="grid-column: 1 / -1;">' +
          '<i class="fa fa-store fa-2x opacity-50 mb-2 d-block"></i>' +
          '<div class="fw-semibold small">Please select a store above to view its Services.</div>' +
        "</div>"
      );
      return;
    }

    if (!jobTypeTree || jobTypeTree.length === 0) {
      $track.html(
        '<div class="text-center py-4 text-muted w-100" style="grid-column: 1 / -1;">' +
          '<i class="fa fa-sitemap fa-2x opacity-50 mb-2 d-block"></i>' +
          '<div class="fw-semibold small mb-2">No Active Services Found</div>' +
          '<a href="/job-types" class="btn btn-xs btn-primary"><i class="fa fa-cog me-1"></i>Manage Services</a>' +
        "</div>"
      );
      return;
    }

    const htmlParts = [];
    for (const root of jobTypeTree) {
      const hasDirectPrices = Number(root.pricedCount) > 0;
      const isClickable = hasDirectPrices;
      const isCurrentActive = Boolean(activeJobType && Number(activeJobType.id) === Number(root.id));

      const classes = [
        "pos2-jt-tile",
        "pos2-jt-parent-tile",
        isCurrentActive ? "is-selected" : "",
        isClickable ? "" : "is-disabled",
      ]
        .filter(Boolean)
        .join(" ");

      htmlParts.push(
        `<button type="button" class="${classes}" role="option" ` +
          `aria-selected="${isCurrentActive ? "true" : "false"}" ` +
          `data-jt-id="${root.id}" ` +
          `data-has-prices="${hasDirectPrices ? "1" : "0"}" ` +
          `${isClickable ? "" : 'disabled aria-disabled="true" title="No priced items configured"'}>` +
          buildTileInnerHtml(root, false, "") +
        `</button>`
      );
    }

    $track.html(htmlParts.join(""));
  }

  function renderJobTypeModalUI() {
    renderParentJobTypesSection();
  }

  function openJobTypeModal(allowDismiss) {
    const canDismiss = Boolean(allowDismiss && activeJobType && activeJobType.id);
    $("#btnPos2JobTypeModalClose").toggleClass("d-none", !canDismiss);

    const modalEl = document.getElementById("pos2JobTypeModal");
    if (!modalEl) return;

    activeParentJtId = null;
    pendingSelectedJtId = null;
    renderJobTypeModalUI();

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
    const $cartChipText = $("#pos2_cart_job_type_text");
    const $cartCount = $("#pos2_cart_service_count");

    if (activeJobType) {
      const crumbText = formatBreadcrumbText(activeBreadcrumb, activeJobType.name);
      $barName.text(crumbText);
      const cnt = Number(activeJobType.pricedCount) || 0;
      const cntLabel = `${cnt} ${cnt === 1 ? "item" : "items"}`;
      $barCount.text(cntLabel).removeClass("d-none");
      $barBtnLabel.text("Change Service");
      if ($cartChipText.length) {
        $cartChipText.text(crumbText);
      }
      if ($cartCount.length) {
        $cartCount.text(cntLabel).removeClass("d-none");
      }
    } else {
      $barName.text("No Service Selected");
      $barCount.addClass("d-none");
      $barBtnLabel.text("Select Service");
      if ($cartChipText.length) {
        $cartChipText.text("No Service Selected");
      }
      if ($cartCount.length) {
        $cartCount.addClass("d-none");
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

  let isSelectingService = false;

  function confirmSelectedJobType(clearCartFlag, $clickedTile) {
    if (!pendingSelectedJtId || isSelectingService) return;
    isSelectingService = true;

    const $allTiles = $("#pos2ParentSliderTrack .pos2-jt-parent-tile");
    $allTiles.addClass("is-loading");
    if ($clickedTile && $clickedTile.length) {
      $clickedTile.addClass("is-selected");
    }

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
        } else {
          if (typeof toastr !== "undefined") {
            toastr.error((res && res.message) || "Failed to load Service items.");
          }
        }
      },
      error: function (xhr) {
        const resp = xhr && xhr.responseJSON ? xhr.responseJSON : {};
        if (xhr && xhr.status === 409 && resp.requiresClear) {
          const pickerEl = document.getElementById("pos2JobTypeModal");
          if (pickerEl) {
            const inst = bootstrap.Modal.getInstance(pickerEl);
            if (inst) inst.hide();
          }
          $("#pos2SwitchCurrentJtName").text(
            formatBreadcrumbText(activeBreadcrumb, activeJobType ? activeJobType.name : "current Service")
          );
          const confirmEl = document.getElementById("pos2SwitchJobTypeConfirmModal");
          if (confirmEl) {
            bootstrap.Modal.getOrCreateInstance(confirmEl).show();
          }
          return;
        }
        if (typeof toastr !== "undefined") {
          toastr.error(resp.message || "Error selecting Service.");
        }
      },
      complete: function () {
        isSelectingService = false;
        $allTiles.removeClass("is-loading");
      },
    });
  }

  function loadStoreContextForPos2(storeId) {
    if (!storeId || storeId === "0") return;

    $("#pos2ParentSliderTrack").html(
      '<div class="text-center py-4 text-muted w-100">' +
        '<div class="spinner-border spinner-border-sm text-primary me-2" role="status"></div>' +
        "<span>Loading store job types...</span>" +
      "</div>"
    );

    $.ajax({
      type: "GET",
      url: baseUrl + "/admin/clearcart",
      dataType: "json",
      complete: function () {
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
                    `<input class="form-check-input pos-addon-checkbox" type="checkbox" name="addon" id="update_customer_read_${ad.id}" value="${ad.id}" data-addon-name="${escapeHtml(ad.addon)}" data-default-price="${p}">` +
                    `<label class="form-check-label fw-semibold mb-0" for="update_customer_read_${ad.id}">${escapeHtml(ad.addon)}</label>` +
                    "</div>" +
                    '<div class="input-group input-group-sm" style="width: 115px;">' +
                    `<span class="input-group-text">${escapeHtml(sym)}</span>` +
                    `<input type="number" class="form-control pos-modal-addon-price text-end" name="addon_price_${ad.id}" id="pos_addon_price_${ad.id}" data-addon-id="${ad.id}" data-default-price="${p}" value="${p}" min="0" step="0.25">` +
                    "</div>" +
                    "</div>" +
                    "</div>";
                });
                $addonsBox.html(addonHtml);
              }
            }
          },
        });

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
            activeParentJtId = null;
            pendingSelectedJtId = null;
            renderJobTypeModalUI();
            const modalEl = document.getElementById("pos2JobTypeModal");
            if (modalEl && !modalEl.classList.contains("show")) {
              openJobTypeModal(false);
            }
          },
          error: function () {
            $("#pos2ParentSliderTrack").html(
              '<div class="text-center py-4 text-danger w-100">Failed to load job types for this store.</div>'
            );
          },
        });
      },
    });
  }

  // =========================================================================
  // Event Bindings
  // =========================================================================

  // Single-Click Parent Service Card -> immediately select and start ordering
  $(document).on("click", ".pos2-jt-parent-tile:not(.is-disabled)", function () {
    const $tile = $(this);
    const parentId = Number($tile.attr("data-jt-id"));
    if (!parentId) return;
    activeParentJtId = parentId;
    pendingSelectedJtId = parentId;
    confirmSelectedJobType(pendingSwitchClearCart, $tile);
  });

  // Change / Select Service Button on POS-2 Screen
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

  // Confirm Clearing Cart Before Switching Job Type
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

  // Store Selector Sync (Master Admin): inside modal <-> topbar
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

  // Direct Single-Click Add to Cart (bypasses Service Type popup completely)
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
    ensureBeepAudioContext();
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
          playPosCartBeep();
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
