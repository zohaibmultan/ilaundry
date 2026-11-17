/**
 * iCleaners Service Image Cropper (1:1 Square Ratio)
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
                originalImageSrc: ''
            }, options || {});

            const fileInput = document.getElementById(config.fileInputId);
            const previewImg = document.getElementById(config.previewImgId);
            const cropBtn = document.getElementById(config.cropBtnId);
            const errorEl = config.errorElId ? document.getElementById(config.errorElId) : null;
            const modalEl = document.getElementById(config.modalId);
            const targetImg = document.getElementById(config.targetImgId);
            const confirmBtn = document.getElementById(config.confirmBtnId);

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

            // Check if there is an existing original image on edit forms
            if (config.originalImageSrc && !config.originalImageSrc.endsWith('one.png')) {
                currentSourceUrl = config.originalImageSrc;
                const pathParts = config.originalImageSrc.split('/');
                currentFileName = pathParts[pathParts.length - 1] || 'service.png';
                if (currentFileName.toLowerCase().endsWith('.jpg') || currentFileName.toLowerCase().endsWith('.jpeg')) {
                    currentMimeType = 'image/jpeg';
                }
            }

            // Listen for user uploading a new file
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
                    fileInput.click();
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
                if (errorEl) {
                    errorEl.classList.add('d-none');
                }
            };
        }
    };

})(window, window.jQuery);
