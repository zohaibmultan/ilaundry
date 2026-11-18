const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });
const { conn } = require("../../middelwer/db");

const promisePool = conn.promise();

const MULTI_PIECE_MAP = {
  "GP-013": 2, // Suit 2-Piece
  "GP-014": 3, // Suit 3-Piece
  "GP-082": 2, // Pajamas Set
  "GP-090": 2, // Tracksuit Set
  "GP-094": 2, // Bedsheet Set
};

// Realistic dummy 5-tier pricing: [DRY CLEAN, WET CLEAN, GREEN PROCESS, PRESS ONLY, STEAM CLEAN]
function getDummyPrices(code, itemName) {
  const n = itemName.toLowerCase();
  if (code === "GP-027") return "120.00,120.00,180.00,90.00,60.00"; // Wedding Dress
  if (code === "GP-091" || code === "GP-026") return "60.00,60.00,90.00,48.00,30.00"; // Comforter, Prom Dress
  if (code === "GP-102" || code === "GP-103") return "22.00,18.00,25.00,12.00,10.00"; // Wash & Fold, Laundry Basket
  if (
    n.includes("coat") ||
    n.includes("parka") ||
    n.includes("leather") ||
    n.includes("suede") ||
    n.includes("blanket") ||
    n.includes("quilt") ||
    n.includes("drapes")
  ) {
    if (n.includes("chef") || n.includes("lab") || n.includes("housecoat") || n.includes("petticoat")) {
      return "18.00,18.00,24.00,12.00,9.00";
    }
    return "48.00,48.00,60.00,36.00,24.00";
  }
  if (
    code === "GP-014" || // Suit 3-Piece
    n.includes("jacket") ||
    n.includes("windbreaker") ||
    n.includes("evening dress") ||
    n.includes("cocktail dress") ||
    n.includes("bridesmaid") ||
    n.includes("formal") ||
    n.includes("duvet") ||
    n.includes("tablecloth")
  ) {
    if (code === "GP-016" || code === "GP-012") return "20.00,20.00,26.00,14.00,10.00"; // Dinner Jacket / Suit Jacket Blazer
    return "36.00,36.00,48.00,24.00,18.00";
  }
  if (code === "GP-013") return "30.00,30.00,36.00,20.00,15.00"; // Suit 2-Piece
  if (
    n.includes("dress") ||
    n.includes("jumpsuit") ||
    n.includes("kimono") ||
    n.includes("cardigan") ||
    n.includes("poncho") ||
    n.includes("cape") ||
    n.includes("shawl") ||
    n.includes("robe") ||
    n.includes("bedsheet") ||
    n.includes("uniform") ||
    n.includes("tracksuit") ||
    n.includes("pajamas")
  ) {
    return "20.00,18.00,24.00,12.00,10.00";
  }
  if (
    n.includes("tie") ||
    n.includes("socks") ||
    n.includes("handkerchief") ||
    n.includes("pocket square") ||
    n.includes("napkin") ||
    n.includes("belt") ||
    n.includes("gloves") ||
    n.includes("mittens") ||
    n.includes("beanie") ||
    n.includes("cap") ||
    n.includes("scarf") ||
    n.includes("hat") ||
    n.includes("sash") ||
    n.includes("cummerbund") ||
    n.includes("suspenders") ||
    n.includes("pillowcase") ||
    n.includes("underwear") ||
    n.includes("undershirt") ||
    n.includes("lingerie") ||
    n.includes("stockings")
  ) {
    return "8.00,7.00,10.00,5.00,4.00";
  }
  // Standard shirts, blouses, pants, jeans, skirts, sweaters, hoodies, vests, etc.
  return "12.00,11.00,15.00,8.00,6.00";
}

function resolveImageFilename(itemName) {
  const uploadsSmallDir = path.join(__dirname, "../../public/uploads/small");
  const candidates = [
    `${itemName}.png`,
    `${itemName.replace(/\s+/g, "_")}.png`,
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(uploadsSmallDir, c))) {
      return c;
    }
  }
  return `${itemName}.png`;
}

async function ensureDefaultCategoryAndTypes(storeId) {
  // 1. Ensure 'Default' category exists for this store
  const [cats] = await promisePool.query(
    "SELECT id, name FROM tbl_service_category WHERE store_ID = ? AND delete_flage = '0' ORDER BY sequence_no ASC, id ASC",
    [String(storeId)]
  );
  let defaultCatId = null;
  const existingDefault = cats.find((c) => c.name.trim().toLowerCase() === "default");
  if (existingDefault) {
    defaultCatId = existingDefault.id;
  } else {
    const [ins] = await promisePool.query(
      "INSERT INTO tbl_service_category (name, sequence_no, status, store_ID, delete_flage) VALUES ('Default', 1, '0', ?, '0')",
      [String(storeId)]
    );
    defaultCatId = ins.insertId;
    console.log(`✅ Created 'Default' category (id=${defaultCatId}) for store ${storeId}`);
  }

  // 2. Ensure the 5 standard service types exist for this store
  const requiredTypes = [
    "DRY CLEAN",
    "WET CLEAN",
    "GREEN PROCESS",
    "PRESS ONLY",
    "STEAM CLEAN",
  ];
  const [existingTypes] = await promisePool.query(
    "SELECT id, services_type, sequence_no FROM tbl_services_type WHERE store_ID = ? ORDER BY sequence_no ASC, id ASC",
    [String(storeId)]
  );

  let maxSeq = existingTypes.reduce((m, t) => Math.max(m, Number(t.sequence_no) || 0), 0);
  const typeIds = [];

  for (const reqName of requiredTypes) {
    let found = existingTypes.find(
      (t) => String(t.services_type || "").trim().toUpperCase() === reqName
    );
    if (!found) {
      maxSeq += 1;
      const [ins] = await promisePool.query(
        "INSERT INTO tbl_services_type (services_type, status, store_ID, sequence_no) VALUES (?, '0', ?, ?)",
        [reqName, String(storeId), maxSeq]
      );
      found = { id: ins.insertId, services_type: reqName, sequence_no: maxSeq };
      existingTypes.push(found);
      console.log(`✅ Created service type '${reqName}' (id=${found.id}) for store ${storeId}`);
    }
    typeIds.push(found.id);
  }

  return { defaultCatId, typeIds };
}

async function run() {
  console.log("==================================================");
  console.log("   SEEDING ALL SERVICES FROM item_index_alphabetical.csv");
  console.log("==================================================");

  const csvPath = path.join(__dirname, "../../item_index_alphabetical.csv");
  const lines = fs
    .readFileSync(csvPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .slice(1);

  const csvItems = lines
    .map((line) => {
      const parts = line.split(",");
      if (parts.length < 3) return null;
      return {
        display_order: parseInt(parts[0].trim(), 10) || 0,
        pos_item_code: parts[1].trim(),
        item_name: parts[2].trim(),
      };
    })
    .filter(Boolean);

  console.log(`Loaded ${csvItems.length} items from CSV.`);

  const [stores] = await promisePool.query(
    "SELECT id, name FROM tbl_store WHERE delete_flage = '0' ORDER BY id ASC"
  );
  console.log(`Found ${stores.length} active stores:`, stores.map((s) => `${s.id} (${s.name})`).join(", "));

  let totalInserted = 0;
  let totalUpdated = 0;

  for (const store of stores) {
    const storeId = String(store.id);
    const { defaultCatId, typeIds } = await ensureDefaultCategoryAndTypes(storeId);

    const typeIdStr = typeIds.join(",");
    const typeSeqStr = typeIds.map((_, i) => i + 1).join(",");
    const typeReadyStr = typeIds.map(() => 1440).join(",");

    let storeInserted = 0;
    let storeUpdated = 0;

    for (const item of csvItems) {
      const imageFile = resolveImageFilename(item.item_name);
      const pieces = MULTI_PIECE_MAP[item.pos_item_code] || 1;
      const typeItemsStr = typeIds.map(() => pieces).join(",");
      const priceStr = getDummyPrices(item.pos_item_code, item.item_name);

      const [existing] = await promisePool.query(
        "SELECT id FROM tbl_services WHERE store_ID = ? AND (item_code = ? OR LOWER(TRIM(name)) = LOWER(?)) LIMIT 1",
        [storeId, item.pos_item_code, item.item_name]
      );

      if (existing.length > 0) {
        await promisePool.query(
          `UPDATE tbl_services
           SET name = ?, item_code = ?, image = ?, services_type_id = ?, services_type_price = ?,
               status = '0', sequance_no = ?, sequence_no = ?, services_type_sequence = ?,
               services_type_items = ?, services_type_ready_time = ?, no_of_items = ?,
               category_id = ?, subcategory_id = NULL
           WHERE id = ?`,
          [
            item.item_name,
            item.pos_item_code,
            imageFile,
            typeIdStr,
            priceStr,
            item.display_order,
            item.display_order,
            typeSeqStr,
            typeItemsStr,
            typeReadyStr,
            pieces,
            defaultCatId,
            existing[0].id,
          ]
        );
        storeUpdated++;
        totalUpdated++;
      } else {
        await promisePool.query(
          `INSERT INTO tbl_services
            (name, item_code, image, services_type_id, services_type_price, store_ID, status,
             sequance_no, sequence_no, services_type_sequence, services_type_items,
             services_type_ready_time, no_of_items, category_id, subcategory_id)
           VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?, ?, ?, ?, ?, ?, NULL)`,
          [
            item.item_name,
            item.pos_item_code,
            imageFile,
            typeIdStr,
            priceStr,
            storeId,
            item.display_order,
            item.display_order,
            typeSeqStr,
            typeItemsStr,
            typeReadyStr,
            pieces,
            defaultCatId,
          ]
        );
        storeInserted++;
        totalInserted++;
      }
    }

    console.log(
      `Store ${storeId} (${store.name}): Inserted ${storeInserted}, Updated ${storeUpdated} services in 'Default' category (id=${defaultCatId}).`
    );
  }

  console.log("==================================================");
  console.log(`Seeding Complete: ${totalInserted} inserted, ${totalUpdated} updated across ${stores.length} stores.`);
  console.log("==================================================");
  process.exit(0);
}

run().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
