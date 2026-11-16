const fs = require("fs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../../config.env") });
const { DataFind } = require("../../middelwer/databaseQurey");
const { conn } = require("../../middelwer/db");

const promisePool = conn.promise();

const MULTI_PIECE_MAP = {
  "GP-013": 2, // Suit 2-Piece
  "GP-014": 3, // Suit 3-Piece
  "GP-082": 2, // Pajamas Set
  "GP-090": 2, // Tracksuit Set
};

// Category-appropriate 5-tier pricing: [DRY CLEAN, WET CLEAN, GREEN PROCESS, PRESS ONLY, STEAM CLEAN]
function getDefaultPricesForCode(code, itemName) {
  const n = itemName.toLowerCase();
  if (code === "GP-027") return "120,120,180,90,60"; // Wedding Dress
  if (code === "GP-091" || code === "GP-026") return "60,60,90,48,30"; // Comforter, Prom Dress
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
      return "18,18,24,12,9";
    }
    return "48,48,60,36,24";
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
    if (code === "GP-016" || code === "GP-012") return "18,18,24,12,9"; // Dinner Jacket / Suit Jacket Blazer
    return "36,36,48,24,18";
  }
  if (code === "GP-013") return "30,30,36,20,15"; // Suit 2-Piece
  if (
    n.includes("dress") ||
    n.includes("jumpsuit") ||
    n.includes("kimono") ||
    n.includes("cardigan") ||
    n.includes("poncho") ||
    n.includes("cape") ||
    n.includes("shawl") ||
    n.includes("scarf") ||
    n.includes("hat") ||
    n.includes("cap") ||
    n.includes("beanie") ||
    n.includes("gloves") ||
    n.includes("mittens") ||
    n.includes("belt") ||
    n.includes("bedsheet") ||
    n.includes("pillow") ||
    n.includes("robe") ||
    n.includes("other specialty")
  ) {
    if (n.includes("mens dress shirt") || n.includes("slacks dress pants")) {
      return "12,12,18,8,6";
    }
    if (n.includes("pillowcase")) {
      return "12,12,18,8,6";
    }
    return "24,24,36,18,12";
  }
  if (
    n.includes("hoodie") ||
    n.includes("sweatshirt") ||
    n.includes("sweater") ||
    n.includes("turtleneck") ||
    n.includes("tracksuit") ||
    n.includes("pajamas") ||
    n.includes("uniform") ||
    n.includes("scrub") ||
    n.includes("culottes") ||
    n.includes("jeans")
  ) {
    return "18,18,24,12,9";
  }
  if (
    n.includes("napkin") ||
    n.includes("handkerchief") ||
    n.includes("pocket square") ||
    n.includes("socks") ||
    n.includes("stockings") ||
    n.includes("underwear") ||
    n.includes("undershirt")
  ) {
    return "9,9,12,6,5";
  }
  return "12,12,18,8,6";
}

// Explicit synonym map from existing DB service names (normalized upper) to pos_item_code
const SYNONYM_TO_CODE = {
  // Store 20 synonyms
  "SHIRT": "GP-001",               // Mens Dress Shirt
  "SUIT 2 PC": "GP-013",           // Suit 2-Piece
  "BLOUSE": "GP-002",              // Womens Blouse
  "PANTS": "GP-017",               // Slacks Dress Pants
  "SKIRT": "GP-021",               // Skirt
  "BLAZER": "GP-012",              // Suit Jacket Blazer
  "SWEATER": "GP-007",             // Sweater
  "DRESS": "GP-023",               // Dress Casual
  "JUMPSUIT": "GP-030",            // Jumpsuit
  "EVE DRESS": "GP-025",           // Evening Dress
  "GOWN": "GP-024",                // Dress Formal
  "COAT": "GP-032",                // Overcoat
  "WINTER JACKET": "GP-033",       // Winter Coat
  "SPRING JACKET": "GP-031",       // Coat Light
  "HOODIE": "GP-005",              // Hoodie
  "VEST": "GP-011",                // Vest
  "SHAWL": "GP-057",               // Shawl Wrap
  "CARDIGAN": "GP-008",            // Cardigan
  "HAT": "GP-059",                 // Hat
  "GLOVES": "GP-062",              // Gloves
  "SCARF": "GP-058",               // Scarf
  "TIE": "GP-065",                 // Tie
  "DRAPE": "GP-099",               // Drapes Curtains
  "CURTAIN": "GP-099",             // Drapes Curtains (secondary existing item in Store 20)
  "COMFORTER": "GP-091",           // Comforter
  "QUILT": "GP-093",               // Bedspread Quilt
  "BLANKET": "GP-092",             // Blanket
  "DUVET COVER": "GP-097",         // Duvet Cover
  "BED SHEET": "GP-094",           // Bedsheet Set
  "PILLOW CASE": "GP-096",         // Pillowcase
  "TABLE CLOTH": "GP-098",         // Tablecloth
  "NAPKIN": "GP-101",              // Napkins
  "CUSHION": "GP-095",             // Pillow

  // Store 19 synonyms
  "TWO-PIECE BUSINESS SUIT": "GP-013",
  "BATH TOWEL & BATHROBE SET": "GP-081",
  "LEATHER BELT & WALLET RESTOR.": "GP-064",
  "HEAVY QUILT & COMFORTER": "GP-091",
  "VELVET DINNER JACKET": "GP-016",
  "SHERWANI BRIDAL WEAR": "GP-027",
  "LAWN COTTON 3-PIECE SUIT": "GP-014",
  "PASHMINA SHAWL": "GP-057",
  "BED SHEET & PILLOWCASE SET": "GP-094",
  "EMBROIDERED KURTA SALWAR": "GP-100",
  "FORMAL TROUSERS": "GP-017",
  "FORMAL WOMEN JUMPSUIT": "GP-030",
  "GENUINE LEATHER BIKER JACKET": "GP-042",
  "TABLECLOTH & NAPKINS (SET)": "GP-098",
  "BLACKOUT CURTAINS (PER PANEL)": "GP-099",
  "HOODIE & SWEATSHIRT": "GP-005",
  "SPORTS TRACKSUIT": "GP-090",
  "EVENING COCKTAIL GOWN": "GP-029",
};

function normName(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function ensureSchema() {
  const [cols] = await promisePool.query("SHOW COLUMNS FROM tbl_services");
  const colNames = cols.map((c) => c.Field);
  if (!colNames.includes("item_code")) {
    await promisePool.query(
      "ALTER TABLE tbl_services ADD COLUMN item_code VARCHAR(50) NULL DEFAULT NULL"
    );
    console.log("Added item_code column to tbl_services.");
  }
}

async function ensureStoreCategoryAndTypes(storeId) {
  // 1. Ensure 'General' category exists for this store
  const [cats] = await promisePool.query(
    "SELECT id, name FROM tbl_service_category WHERE store_ID = ? AND delete_flage = '0' ORDER BY sequence_no ASC, id ASC",
    [String(storeId)]
  );
  let generalCatId = null;
  const gen = cats.find((c) => c.name.trim().toLowerCase() === "general");
  if (gen) {
    generalCatId = gen.id;
  } else if (cats.length > 0) {
    generalCatId = cats[0].id;
  } else {
    const [ins] = await promisePool.query(
      "INSERT INTO tbl_service_category (name, sequence_no, status, store_ID, delete_flage) VALUES ('General', 1, '0', ?, '0')",
      [String(storeId)]
    );
    generalCatId = ins.insertId;
  }

  // 2. Ensure the 5 standard garment service types exist for this store:
  // DRY CLEAN, WET CLEAN, GREEN PROCESS, PRESS ONLY, STEAM CLEAN
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
      console.log(`Created service type '${reqName}' (id=${found.id}) for store ${storeId}`);
    }
    typeIds.push(found.id);
  }

  return { generalCatId, typeIds };
}

async function run() {
  await ensureSchema();

  const csvPath = path.join(__dirname, "../../item_index_alphabetical.csv");
  const csvContent = fs.readFileSync(csvPath, "utf8").trim().split(/\r?\n/);
  const csvItems = csvContent.slice(1).map((line) => {
    const [display_order, pos_item_code, item_name, image_filename] = line.split(",");
    return {
      display_order: Number(display_order.trim()),
      pos_item_code: pos_item_code.trim(),
      item_name: item_name.trim(),
      image_filename: image_filename.trim(),
    };
  });

  const codeToCsv = new Map();
  const normToCsv = new Map();
  for (const item of csvItems) {
    codeToCsv.set(item.pos_item_code, item);
    normToCsv.set(normName(item.item_name), item);
  }

  const [stores] = await promisePool.query(
    "SELECT id, name FROM tbl_store WHERE delete_flage = 0 ORDER BY id ASC"
  );

  for (const store of stores) {
    const storeId = String(store.id);
    const { generalCatId, typeIds } = await ensureStoreCategoryAndTypes(storeId);
    const [existingServices] = await promisePool.query(
      "SELECT * FROM tbl_services WHERE store_ID = ? ORDER BY sequence_no ASC, id ASC",
      [storeId]
    );

    const matchedCsvCodes = new Set();
    let updatedCount = 0;
    let insertedCount = 0;

    for (const svc of existingServices) {
      const upperName = String(svc.name || "").trim().toUpperCase();
      const normalized = normName(svc.name);

      let matchedCsv = null;
      if (svc.item_code && codeToCsv.has(svc.item_code)) {
        matchedCsv = codeToCsv.get(svc.item_code);
      } else if (normToCsv.has(normalized)) {
        matchedCsv = normToCsv.get(normalized);
      } else if (SYNONYM_TO_CODE[upperName] && codeToCsv.has(SYNONYM_TO_CODE[upperName])) {
        matchedCsv = codeToCsv.get(SYNONYM_TO_CODE[upperName]);
      }

      if (matchedCsv) {
        matchedCsvCodes.add(matchedCsv.pos_item_code);
        const targetPieces = MULTI_PIECE_MAP[matchedCsv.pos_item_code] || Number(svc.no_of_items) || 1;
        const typeCount = String(svc.services_type_id || "")
          .split(",")
          .filter(Boolean).length || 1;
        const currentItemsArr = String(svc.services_type_items || "")
          .split(",")
          .filter(Boolean);
        const updatedItemsStr = MULTI_PIECE_MAP[matchedCsv.pos_item_code]
          ? Array(typeCount).fill(targetPieces).join(",")
          : svc.services_type_items || Array(typeCount).fill(targetPieces).join(",");

        await promisePool.query(
          "UPDATE tbl_services SET image = ?, item_code = ?, no_of_items = ?, services_type_items = ? WHERE id = ?",
          [
            matchedCsv.image_filename,
            matchedCsv.pos_item_code,
            targetPieces,
            updatedItemsStr,
            svc.id,
          ]
        );
        updatedCount += 1;
      }
    }

    // Determine starting sequence_no for newly inserted items in this store
    let maxSeq = existingServices.reduce(
      (m, s) => Math.max(m, Number(s.sequence_no) || Number(s.sequance_no) || 0),
      0
    );

    const typeIdStr = typeIds.join(",");
    const typeSeqStr = typeIds.map((_, i) => i + 1).join(",");
    const typeReadyStr = typeIds.map(() => 1440).join(",");

    for (const csvItem of csvItems) {
      if (matchedCsvCodes.has(csvItem.pos_item_code)) {
        continue;
      }
      maxSeq += 1;
      const pieces = MULTI_PIECE_MAP[csvItem.pos_item_code] || 1;
      const typeItemsStr = typeIds.map(() => pieces).join(",");
      const priceStr = getDefaultPricesForCode(csvItem.pos_item_code, csvItem.item_name);

      await promisePool.query(
        `INSERT INTO tbl_services 
          (name, item_code, image, services_type_id, services_type_price, store_ID, status, sequance_no, sequence_no, services_type_sequence, services_type_items, services_type_ready_time, no_of_items, category_id, subcategory_id)
         VALUES (?, ?, ?, ?, ?, ?, '0', ?, ?, ?, ?, ?, ?, ?, NULL)`,
        [
          csvItem.item_name,
          csvItem.pos_item_code,
          csvItem.image_filename,
          typeIdStr,
          priceStr,
          storeId,
          maxSeq,
          maxSeq,
          typeSeqStr,
          typeItemsStr,
          typeReadyStr,
          pieces,
          generalCatId,
        ]
      );
      insertedCount += 1;
    }

    console.log(
      `Store ${storeId} (${store.name}): Updated ${updatedCount} existing items, Inserted ${insertedCount} new items.`
    );
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
