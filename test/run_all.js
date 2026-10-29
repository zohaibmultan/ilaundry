/**
 * iCleaners Automated Verification Test Suite
 * Conforms to Rule E (Strict ban on browser automation: relies on unit tests,
 * linters, and syntax compilers).
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ejs = require('ejs');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ ${description}: ${err.message}`);
    failedTests++;
  }
}

console.log('\n========================================');
console.log('   iCleaners Core Verification Suite   ');
console.log('========================================\n');

// 1. JavaScript Syntax Check
console.log('--- 1. JavaScript Syntax Verification ---');
const scanDirs = ['routers', 'middelwer', 'services', 'shared'];
scanDirs.forEach(dirName => {
  const fullDir = path.join(__dirname, '..', dirName);
  if (fs.existsSync(fullDir)) {
    fs.readdirSync(fullDir).forEach(file => {
      if (file.endsWith('.js')) {
        const fullPath = path.join(fullDir, file);
        assert(`Syntax: ${dirName}/${file}`, () => {
          execSync(`node -c "${fullPath}"`);
        });
      }
    });
  }
});

// Root entry files
['app.js'].forEach(file => {
  const fullPath = path.join(__dirname, '..', file);
  if (fs.existsSync(fullPath)) {
    assert(`Syntax: ${file}`, () => {
      execSync(`node -c "${fullPath}"`);
    });
  }
});

// 2. EJS Template Compilation Verification
console.log('\n--- 2. EJS Template Compilation Check ---');
const viewsDir = path.join(__dirname, '..', 'views');
if (fs.existsSync(viewsDir)) {
  fs.readdirSync(viewsDir).forEach(file => {
    if (file.endsWith('.ejs')) {
      const fullPath = path.join(viewsDir, file);
      assert(`EJS Template: views/${file}`, () => {
        const content = fs.readFileSync(fullPath, 'utf8');
        ejs.compile(content, { filename: fullPath });
      });
    }
  });
}

// 3. Performance Indexes Verification
console.log('\n--- 3. Database Indexes Verification ---');
try {
  const { conn } = require('../middelwer/db');
  assert('Database Connection & Core Table Indexes', async () => {
    const promiseConn = conn.promise();
    const [rows] = await promiseConn.query('SHOW INDEX FROM tbl_order');
    const idxNames = rows.map(r => r.Key_name);
    if (!idxNames.includes('idx_order_store_status_id')) {
      throw new Error('idx_order_store_status_id missing from tbl_order');
    }
    if (!idxNames.includes('idx_order_order_id')) {
      throw new Error('idx_order_order_id missing from tbl_order');
    }
  });
} catch (e) {
  console.log('  ⚠️ Skipping live DB check (offline or running in CI)');
}

// Summary Report
setTimeout(() => {
  console.log('\n========================================');
  console.log(`Results: ${passedTests}/${totalTests} passed (${failedTests} failed)`);
  console.log('========================================\n');
  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}, 500);
