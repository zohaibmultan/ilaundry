/**
 * EJS Template Syntax & Compilation Linter for iLaundry.
 * Scans all .ejs files in views/ to detect parse errors, unclosed tags, or accidental `<% -` spacing.
 * Usage: node .agents/skills/ilaundry-core/scripts/validate-ejs.js
 */

const fs = require("fs");
const path = require("path");
const ejs = require("ejs");

const viewsDir = path.resolve(__dirname, "../../../../views");

if (!fs.existsSync(viewsDir)) {
  console.error("❌ Views directory not found at:", viewsDir);
  process.exit(1);
}

function findEjsFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findEjsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith(".ejs")) {
      results.push(full);
    }
  }
  return results;
}

const files = findEjsFiles(viewsDir);
console.log(`🔍 Found ${files.length} EJS templates in views/. Starting validation...\n`);

let passed = 0;
let warned = 0;
let failed = 0;

for (const file of files) {
  const relative = path.relative(viewsDir, file);
  const content = fs.readFileSync(file, "utf8");

  // Check 1: Lint for dangerous `<% -` spacing
  if (/<%\s+-\s+/.test(content)) {
    console.warn(`⚠️ [SPACING WARNING] ${relative}: Contains '<% -' with accidental spaces. Use '<%-' instead.`);
    warned++;
  }

  // Check 2: Try compiling template with EJS engine
  try {
    ejs.compile(content, {
      filename: file,
      client: false,
    });
    passed++;
  } catch (err) {
    console.error(`❌ [SYNTAX ERROR] ${relative}:`);
    console.error(`   ${err.message.split("\n")[0]}`);
    failed++;
  }
}

console.log("\n=================================");
console.log(`Validation Complete:`);
console.log(`✅ Passed Compilation: ${passed}`);
if (warned > 0) console.log(`⚠️ Warnings: ${warned}`);
if (failed > 0) console.log(`❌ Failed: ${failed}`);
console.log("=================================");

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
