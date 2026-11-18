const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "../..");
const cropedDir = path.join(rootDir, "croped");
const serviceLibraryDir = path.join(rootDir, "public/images/service-library");
const uploadsDir = path.join(rootDir, "public/uploads");
const uploadsServicesDir = path.join(uploadsDir, "services");

const SIZES = ["small", "medium", "large"];

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

async function sync() {
  console.log("=== Starting Service Image Library Sync ===");

  // 1. Ensure target directories exist
  SIZES.forEach((size) => {
    ensureDir(path.join(serviceLibraryDir, size));
    ensureDir(path.join(uploadsDir, size));
  });
  ensureDir(uploadsServicesDir);

  // 2. Read 100 canonical names from item_index_alphabetical.csv
  const csvPath = path.join(rootDir, "item_index_alphabetical.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`item_index_alphabetical.csv not found at ${csvPath}`);
  }

  const csvContent = fs.readFileSync(csvPath, "utf8");
  const lines = csvContent
    .trim()
    .split(/\r?\n/)
    .slice(1);

  const canonicalItems = lines.map((line) => {
    const parts = line.split(",");
    const itemName = parts[2] ? parts[2].trim() : "";
    return itemName;
  }).filter(Boolean);

  console.log(`Found ${canonicalItems.length} canonical garment items.`);

  // 3. Clean root service-library of old files (preserve directories small, medium, large)
  if (fs.existsSync(serviceLibraryDir)) {
    const existing = fs.readdirSync(serviceLibraryDir);
    existing.forEach((f) => {
      const full = path.join(serviceLibraryDir, f);
      if (fs.statSync(full).isFile()) {
        fs.unlinkSync(full);
      }
    });
    console.log("Cleaned root public/images/service-library/ old files.");
  }

  // 4. Copy 100 canonical items for each resolution
  let copiedCount = { small: 0, medium: 0, large: 0 };

  canonicalItems.forEach((name) => {
    const filename = `${name}.png`;
    const aliasFilename = `${name.replace(/\s+/g, "_")}.png`;

    SIZES.forEach((size) => {
      const srcPath = path.join(cropedDir, size, filename);
      if (!fs.existsSync(srcPath)) {
        console.warn(`Warning: Missing ${srcPath}`);
        return;
      }

      // Copy canonical name to size folder in service-library
      const destLib = path.join(serviceLibraryDir, size, filename);
      fs.copyFileSync(srcPath, destLib);

      // Copy alias name to size folder in service-library
      const destLibAlias = path.join(serviceLibraryDir, size, aliasFilename);
      fs.copyFileSync(srcPath, destLibAlias);

      // Copy to uploads/<size>/
      const destUpload = path.join(uploadsDir, size, filename);
      fs.copyFileSync(srcPath, destUpload);
      const destUploadAlias = path.join(uploadsDir, size, aliasFilename);
      fs.copyFileSync(srcPath, destUploadAlias);

      copiedCount[size]++;
    });

    // Copy medium (512x512) to root service-library as standard default
    const medSrc = path.join(cropedDir, "medium", filename);
    if (fs.existsSync(medSrc)) {
      fs.copyFileSync(medSrc, path.join(serviceLibraryDir, filename));
      fs.copyFileSync(medSrc, path.join(serviceLibraryDir, aliasFilename));

      // Also copy to root uploads & uploads/services for fallback
      fs.copyFileSync(medSrc, path.join(uploadsDir, filename));
      fs.copyFileSync(medSrc, path.join(uploadsDir, aliasFilename));
      fs.copyFileSync(medSrc, path.join(uploadsServicesDir, filename));
      fs.copyFileSync(medSrc, path.join(uploadsServicesDir, aliasFilename));
    }
  });

  console.log("Copied counts per resolution:", copiedCount);
  console.log(`public/images/service-library/small count: ${fs.readdirSync(path.join(serviceLibraryDir, "small")).length}`);
  console.log(`public/images/service-library/medium count: ${fs.readdirSync(path.join(serviceLibraryDir, "medium")).length}`);
  console.log(`public/images/service-library/large count: ${fs.readdirSync(path.join(serviceLibraryDir, "large")).length}`);
  console.log(`public/uploads/small count: ${fs.readdirSync(path.join(uploadsDir, "small")).length}`);
  console.log("=== Sync complete successfully ===");
}

sync().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
