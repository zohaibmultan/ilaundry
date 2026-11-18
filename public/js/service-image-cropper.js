/**
 * iCleaners Service Image Cropper & Image Library Picker (1:1 Square Ratio)
 * Powered by Cropper.js (v1.6.2)
 */
(function (window, $) {
    'use strict';

    window.ServiceImageCropper = {
        init: function (options) {
            const config = Object.assign({
                fileInputId: 'file-1',
                previewImgId: 'file-preview',
                cropBtnId: 'btnCropImage',
                errorElId: 'ImgRequired',
                modalId: 'cropImageModal',
                targetImgId: 'cropperTargetImage',
                confirmBtnId: 'btnConfirmCropImage',
                defaultImageSrc: '../images/one.png',
                originalImageSrc: '',
                // Image Library integration options
                libraryBtnId: 'btnOpenImageLibrary',
                libraryModalId: 'serviceImageLibraryModal',
                libraryInputId: 'library_image_input',
                libraryGridId: 'libraryImageGrid',
                librarySearchId: 'libraryImageSearch',
                libraryClearSearchId: 'btnClearLibrarySearch',
                libraryConfirmBtnId: 'btnConfirmLibraryImage',
                libraryCountId: 'libraryImageCount',
                libraryEmptyId: 'libraryEmptyState',
                libraryLoadingId: 'libraryLoading',
                librarySelectedInfoId: 'librarySelectedInfo'
            }, options || {});

            const fileInput = document.getElementById(config.fileInputId);
            const previewImg = document.getElementById(config.previewImgId);
            const cropBtn = document.getElementById(config.cropBtnId);
            const errorEl = config.errorElId ? document.getElementById(config.errorElId) : null;
            const modalEl = document.getElementById(config.modalId);
            const targetImg = document.getElementById(config.targetImgId);
            const confirmBtn = document.getElementById(config.confirmBtnId);

            // Library elements
            const libraryBtn = document.getElementById(config.libraryBtnId);
            const libraryModalEl = document.getElementById(config.libraryModalId);
            const libraryInput = document.getElementById(config.libraryInputId);
            const libraryGrid = document.getElementById(config.libraryGridId);
            const librarySearch = document.getElementById(config.librarySearchId);
            const libraryClearSearch = document.getElementById(config.libraryClearSearchId);
            const libraryConfirmBtn = document.getElementById(config.libraryConfirmBtnId);
            const libraryCount = document.getElementById(config.libraryCountId);
            const libraryEmpty = document.getElementById(config.libraryEmptyId);
            const libraryLoading = document.getElementById(config.libraryLoadingId);
            const librarySelectedInfo = document.getElementById(config.librarySelectedInfoId);

            if (!fileInput || !previewImg || !cropBtn || !modalEl || !targetImg || !confirmBtn) {
                console.warn('[ServiceImageCropper] Missing required DOM elements for cropper initialization.');
                return;
            }

            let cropper = null;
            let currentSourceUrl = null;
            let currentFileName = 'service-cropped.png';
            let currentMimeType = 'image/png';
            let scaleX = 1;
            let scaleY = 1;

            // Image Library cached state
            let cachedLibraryImages = null;
            let selectedLibraryItem = null;

            // Check if there is an existing original image on edit forms
            if (config.originalImageSrc && !config.originalImageSrc.endsWith('one.png')) {
                currentSourceUrl = config.originalImageSrc;
                const pathParts = config.originalImageSrc.split('/');
                currentFileName = pathParts[pathParts.length - 1] || 'service.png';
                if (currentFileName.toLowerCase().endsWith('.jpg') || currentFileName.toLowerCase().endsWith('.jpeg')) {
                    currentMimeType = 'image/jpeg';
                }
            }

            // Listen for user uploading a new file directly
            fileInput.addEventListener('change', function (e) {
                const file = e.target.files && e.target.files[0];
                if (file) {
                    if (currentSourceUrl && currentSourceUrl.startsWith('blob:')) {
                        try { URL.revokeObjectURL(currentSourceUrl); } catch (err) {}
                    }
                    currentSourceUrl = URL.createObjectURL(file);
                    currentFileName = file.name;
                    currentMimeType = file.type || 'image/png';
                    previewImg.src = currentSourceUrl;

                    // Upload takes precedence over library selection
                    if (libraryInput) {
                        libraryInput.value = '';
                    }

                    if (errorEl) {
                        errorEl.classList.add('d-none');
                    }
                }
            });

            // Open Cropper Modal
            cropBtn.addEventListener('click', function () {
                const isPlaceholder = !currentSourceUrl ||
                    currentSourceUrl.endsWith('one.png') ||
                    (previewImg.src && previewImg.src.endsWith('one.png'));

                if (isPlaceholder) {
                    if (typeof toastr !== 'undefined') {
                        toastr.warning('Please select or upload an image first before cropping.', {
                            timeOut: 4000,
                            progressBar: true
                        });
                    } else {
                        alert('Please select or upload an image first before cropping.');
                    }
                    if (libraryBtn) {
                        libraryBtn.focus();
                    } else {
                        fileInput.click();
                    }
                    return;
                }

                // Set target image source
                targetImg.src = currentSourceUrl || previewImg.src;

                // Show modal via Bootstrap Modal API
                const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl);
                bsModal.show();
            });

            // Modal Shown: Initialize Cropper.js instance
            modalEl.addEventListener('shown.bs.modal', function () {
                if (cropper) {
                    cropper.destroy();
                }
                scaleX = 1;
                scaleY = 1;

                if (typeof Cropper === 'undefined') {
                    console.error('[ServiceImageCropper] Cropper.js library is not loaded.');
                    return;
                }

                cropper = new Cropper(targetImg, {
                    aspectRatio: 1, // Enforce 1:1 square crop
                    viewMode: 1,   // Restrict crop box within image canvas
                    dragMode: 'move',
                    autoCropArea: 0.9,
                    responsive: true,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    preview: '.cropper-live-preview',
                    checkOrientation: false
                });
            });

            // Modal Hidden: Destroy Cropper to prevent memory leaks
            modalEl.addEventListener('hidden.bs.modal', function () {
                if (cropper) {
                    cropper.destroy();
                    cropper = null;
                }
            });

            // Toolbar Controls
            const btnZoomIn = document.getElementById('cropperZoomIn');
            const btnZoomOut = document.getElementById('cropperZoomOut');
            const btnRotateLeft = document.getElementById('cropperRotateLeft');
            const btnRotateRight = document.getElementById('cropperRotateRight');
            const btnFlipH = document.getElementById('cropperFlipH');
            const btnFlipV = document.getElementById('cropperFlipV');
            const btnReset = document.getElementById('cropperReset');

            if (btnZoomIn) btnZoomIn.addEventListener('click', function () { if (cropper) cropper.zoom(0.1); });
            if (btnZoomOut) btnZoomOut.addEventListener('click', function () { if (cropper) cropper.zoom(-0.1); });
            if (btnRotateLeft) btnRotateLeft.addEventListener('click', function () { if (cropper) cropper.rotate(-90); });
            if (btnRotateRight) btnRotateRight.addEventListener('click', function () { if (cropper) cropper.rotate(90); });
            if (btnFlipH) btnFlipH.addEventListener('click', function () {
                if (cropper) {
                    scaleX = -scaleX;
                    cropper.scaleX(scaleX);
                }
            });
            if (btnFlipV) btnFlipV.addEventListener('click', function () {
                if (cropper) {
                    scaleY = -scaleY;
                    cropper.scaleY(scaleY);
                }
            });
            if (btnReset) btnReset.addEventListener('click', function () {
                if (cropper) {
                    scaleX = 1;
                    scaleY = 1;
                    cropper.reset();
                }
            });

            // Confirm & Apply Cropped Output
            confirmBtn.addEventListener('click', function () {
                if (!cropper) return;

                const isJpeg = currentMimeType === 'image/jpeg' || currentMimeType === 'image/jpg';
                const outputMime = isJpeg ? 'image/jpeg' : 'image/png';
                const outputExt = isJpeg ? '.jpg' : '.png';

                const canvas = cropper.getCroppedCanvas({
                    width: 400,
                    height: 400,
                    fillColor: isJpeg ? '#ffffff' : 'transparent',
                    imageSmoothingEnabled: true,
                    imageSmoothingQuality: 'high'
                });

                if (!canvas) {
                    console.error('[ServiceImageCropper] Failed to retrieve cropped canvas.');
                    return;
                }

                canvas.toBlob(function (blob) {
                    if (!blob) {
                        console.error('[ServiceImageCropper] Canvas toBlob returned null.');
                        return;
                    }

                    const baseName = (currentFileName || 'service-image').replace(/\.[^/.]+$/, '');
                    const finalName = baseName + '-cropped' + outputExt;
                    const croppedFile = new File([blob], finalName, {
                        type: outputMime,
                        lastModified: Date.now()
                    });

                    // Stage the cropped File into the file input using DataTransfer
                    if (window.DataTransfer) {
                        try {
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(croppedFile);
                            fileInput.files = dataTransfer.files;
                        } catch (dtErr) {
                            console.warn('[ServiceImageCropper] DataTransfer assignment failed:', dtErr);
                        }
                    }

                    // A cropped staged file replaces any raw library image string
                    if (libraryInput) {
                        libraryInput.value = '';
                    }

                    // Update UI preview
                    if (currentSourceUrl && currentSourceUrl.startsWith('blob:')) {
                        try { URL.revokeObjectURL(currentSourceUrl); } catch (e) {}
                    }
                    currentSourceUrl = URL.createObjectURL(blob);
                    previewImg.src = currentSourceUrl;

                    if (errorEl) {
                        errorEl.classList.add('d-none');
                    }

                    // Close Modal
                    const bsModal = bootstrap.Modal.getInstance(modalEl);
                    if (bsModal) {
                        bsModal.hide();
                    }

                    if (typeof toastr !== 'undefined') {
                        toastr.success('Image cropped to 1:1 square successfully!', {
                            timeOut: 3000,
                            progressBar: true
                        });
                    }
                }, outputMime, isJpeg ? 0.92 : undefined);
            });

            // ==============================================================
            // Image Library Modal & Picker Functionality
            // ==============================================================
            function escapeHtml(str) {
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function renderLibraryGrid(filterTerm) {
                if (!libraryGrid || !cachedLibraryImages) return;
                const term = (filterTerm || '').toLowerCase().trim();

                const filtered = cachedLibraryImages.filter(function (item) {
                    if (!term) return true;
                    return item.label.toLowerCase().includes(term) || item.filename.toLowerCase().includes(term);
                });

                if (libraryCount) {
                    libraryCount.textContent = filtered.length;
                }

                if (filtered.length === 0) {
                    libraryGrid.innerHTML = '';
                    if (libraryEmpty) libraryEmpty.classList.remove('d-none');
                    return;
                }

                if (libraryEmpty) libraryEmpty.classList.add('d-none');

                let html = '';
                filtered.forEach(function (item) {
                    const isSelected = selectedLibraryItem && selectedLibraryItem.filename === item.filename;
                    html += `
                        <div class="col">
                            <div class="library-img-card ${isSelected ? 'selected' : ''}" 
                                 data-filename="${escapeHtml(item.filename)}" 
                                 data-label="${escapeHtml(item.label)}" 
                                 data-url="${escapeHtml(item.url)}"
                                 title="${escapeHtml(item.label)}">
                                <div class="selected-check"><i class="fa fa-check"></i></div>
                                <div class="library-img-thumb-wrap">
                                    <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.label)}" loading="lazy">
                                </div>
                                <div class="library-img-label">${escapeHtml(item.label)}</div>
                            </div>
                        </div>
                    `;
                });

                libraryGrid.innerHTML = html;

                // Bind click and double-click handlers on cards
                const cards = libraryGrid.querySelectorAll('.library-img-card');
                cards.forEach(function (card) {
                    card.addEventListener('click', function () {
                        cards.forEach(c => c.classList.remove('selected'));
                        card.classList.add('selected');
                        selectedLibraryItem = {
                            filename: card.getAttribute('data-filename'),
                            label: card.getAttribute('data-label'),
                            url: card.getAttribute('data-url')
                        };
                        if (librarySelectedInfo) {
                            librarySelectedInfo.textContent = 'Selected: ' + selectedLibraryItem.label;
                        }
                        if (libraryConfirmBtn) {
                            libraryConfirmBtn.disabled = false;
                        }
                    });

                    card.addEventListener('dblclick', function () {
                        selectedLibraryItem = {
                            filename: card.getAttribute('data-filename'),
                            label: card.getAttribute('data-label'),
                            url: card.getAttribute('data-url')
                        };
                        applySelectedLibraryImage();
                    });
                });
            }

            function applySelectedLibraryImage() {
                if (!selectedLibraryItem) return;

                if (libraryInput) {
                    libraryInput.value = selectedLibraryItem.filename;
                }

                // Clear any staged local file so library selection takes precedence
                fileInput.value = '';

                if (currentSourceUrl && currentSourceUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(currentSourceUrl); } catch (e) {}
                }
                currentSourceUrl = selectedLibraryItem.url;
                currentFileName = selectedLibraryItem.filename;
                currentMimeType = selectedLibraryItem.filename.toLowerCase().endsWith('.jpg') ? 'image/jpeg' : 'image/png';

                previewImg.src = selectedLibraryItem.url;

                if (errorEl) {
                    errorEl.classList.add('d-none');
                }

                if (libraryModalEl) {
                    const bsModal = bootstrap.Modal.getInstance(libraryModalEl);
                    if (bsModal) {
                        bsModal.hide();
                    }
                }

                if (typeof toastr !== 'undefined') {
                    toastr.info('Selected "' + selectedLibraryItem.label + '" from image library', {
                        timeOut: 3000,
                        progressBar: true
                    });
                }
            }

            function fetchLibraryImages() {
                if (libraryLoading) libraryLoading.classList.remove('d-none');
                if (libraryEmpty) libraryEmpty.classList.add('d-none');

                var storeInput = document.querySelector('select[name="storeid"], select[name="store_ID"], #add_servie_storelist');
                var storeVal = storeInput ? storeInput.value : '';
                var fetchUrl = storeVal ? ('/services/image-library?store_id=' + encodeURIComponent(storeVal)) : '/services/image-library';

                fetch(fetchUrl, {
                    headers: { 'Accept': 'application/json' }
                })
                    .then(function (res) { return res.json(); })
                    .then(function (data) {
                        if (libraryLoading) libraryLoading.classList.add('d-none');
                        if (data && data.success && Array.isArray(data.images)) {
                            cachedLibraryImages = data.images;
                            renderLibraryGrid(librarySearch ? librarySearch.value : '');
                        } else {
                            if (typeof toastr !== 'undefined') {
                                toastr.error('Failed to load image library');
                            }
                        }
                    })
                    .catch(function (err) {
                        if (libraryLoading) libraryLoading.classList.add('d-none');
                        console.error('[ServiceImageCropper] Error fetching image library:', err);
                        if (typeof toastr !== 'undefined') {
                            toastr.error('Failed to connect to image library');
                        }
                    });
            }

            // Open Library Modal Button
            if (libraryBtn && libraryModalEl) {
                libraryBtn.addEventListener('click', function () {
                    const bsModal = bootstrap.Modal.getOrCreateInstance(libraryModalEl);
                    bsModal.show();

                    if (!cachedLibraryImages) {
                        fetchLibraryImages();
                    } else {
                        renderLibraryGrid(librarySearch ? librarySearch.value : '');
                    }
                });
            }

            // Search filter event
            if (librarySearch) {
                librarySearch.addEventListener('input', function () {
                    renderLibraryGrid(this.value);
                });
            }

            // Clear search filter button
            if (libraryClearSearch && librarySearch) {
                libraryClearSearch.addEventListener('click', function () {
                    librarySearch.value = '';
                    renderLibraryGrid('');
                    librarySearch.focus();
                });
            }

            // Confirm selection button
            if (libraryConfirmBtn) {
                libraryConfirmBtn.addEventListener('click', function () {
                    applySelectedLibraryImage();
                });
            }

            // Expose a helper to reset state when user clicks Reset on form
            window.resetServiceImageCropper = function () {
                if (currentSourceUrl && currentSourceUrl.startsWith('blob:')) {
                    try { URL.revokeObjectURL(currentSourceUrl); } catch (e) {}
                }
                if (config.originalImageSrc && !config.originalImageSrc.endsWith('one.png')) {
                    currentSourceUrl = config.originalImageSrc;
                    previewImg.src = config.originalImageSrc;
                } else {
                    currentSourceUrl = null;
                    previewImg.src = config.defaultImageSrc;
                }
                fileInput.value = '';
                if (libraryInput) {
                    libraryInput.value = '';
                }
                selectedLibraryItem = null;
                if (librarySelectedInfo) {
                    librarySelectedInfo.textContent = 'Double-click or select an image';
                }
                if (libraryConfirmBtn) {
                    libraryConfirmBtn.disabled = true;
                }
                if (errorEl) {
                    errorEl.classList.add('d-none');
                }
            };
        }
    };

})(window, window.jQuery);
