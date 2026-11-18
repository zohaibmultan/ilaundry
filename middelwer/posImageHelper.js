const fs = require("fs");
const path = require("path");
const { DataFind } = require("./databaseQurey");

const ALLOWED_SIZES = ["small", "medium", "large"];
const DEFAULT_SIZE = "medium";

/**
 * Normalizes input image size to 'small', 'medium', or 'large'.
 * Returns defaultVal if invalid.
 */
function normalizePosImageSize(val, defaultVal = DEFAULT_SIZE) {
  if (val && typeof val === "string") {
    const clean = val.trim().toLowerCase();
    if (ALLOWED_SIZES.includes(clean)) {
      return clean;
    }
  }
  return defaultVal;
}

/**
 * Resolves effective POS image size for a given store.
 * Merges tbl_store override with tbl_master_shop global setting.
 */
async function getEffectivePosImageSize(storeId) {
  try {
    // 1. Check store-level override if storeId is provided
    if (storeId && storeId !== "0" && storeId !== 0) {
      const storeRows = await DataFind(
        `SELECT pos_image_size FROM tbl_store WHERE id = '${storeId}' LIMIT 1`
      );
      if (storeRows && storeRows.length > 0 && storeRows[0].pos_image_size) {
        const storeSize = normalizePosImageSize(storeRows[0].pos_image_size, null);
        if (storeSize) {
          return storeSize;
        }
      }
    }

    // 2. Fall back to master shop global setting
    const masterRows = await DataFind(
      "SELECT pos_image_size FROM tbl_master_shop LIMIT 1"
    );
    if (masterRows && masterRows.length > 0 && masterRows[0].pos_image_size) {
      return normalizePosImageSize(masterRows[0].pos_image_size, DEFAULT_SIZE);
    }
  } catch (error) {
    console.error("Error resolving getEffectivePosImageSize:", error);
  }

  return DEFAULT_SIZE;
}

/**
 * Resolves the public URL for a service image according to the configured size.
 * Checks for size-specific folder first, then falls back to root uploads.
 */
function resolvePosServiceImageUrl(filename, size = DEFAULT_SIZE) {
  if (!filename || typeof filename !== "string") {
    return "";
  }

  const validSize = normalizePosImageSize(size, DEFAULT_SIZE);
  const cleanName = path.basename(filename.trim());
  if (!cleanName) return "";

  const uploadsDir = path.join(__dirname, "../public/uploads");
  const sizePath = path.join(uploadsDir, validSize, cleanName);

  if (fs.existsSync(sizePath)) {
    return `/uploads/${validSize}/${encodeURIComponent(cleanName)}`;
  }

  const rootPath = path.join(uploadsDir, cleanName);
  if (fs.existsSync(rootPath)) {
    return `/uploads/${encodeURIComponent(cleanName)}`;
  }

  const servicesPath = path.join(uploadsDir, "services", cleanName);
  if (fs.existsSync(servicesPath)) {
    return `/uploads/services/${encodeURIComponent(cleanName)}`;
  }

  // Fallback to the size-specific URL path
  return `/uploads/${validSize}/${encodeURIComponent(cleanName)}`;
}

/**
 * Attaches pos_image_size and pos_image_url to service list or single service object.
 */
async function attachPosImageMeta(services, storeId, precomputedSize = null) {
  const size = precomputedSize
    ? normalizePosImageSize(precomputedSize)
    : await getEffectivePosImageSize(storeId);

  if (Array.isArray(services)) {
    services.forEach((svc) => {
      if (svc) {
        svc.pos_image_size = size;
        svc.pos_image_url = resolvePosServiceImageUrl(svc.image, size);
      }
    });
  } else if (services && typeof services === "object") {
    services.pos_image_size = size;
    services.pos_image_url = resolvePosServiceImageUrl(services.image, size);
  }

  return { size, services };
}

module.exports = {
  ALLOWED_SIZES,
  DEFAULT_SIZE,
  normalizePosImageSize,
  getEffectivePosImageSize,
  resolvePosServiceImageUrl,
  attachPosImageMeta,
};
