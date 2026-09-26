const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Load languages dictionary
const languagesPath = path.join(__dirname, '../public/language/languages.json');
let languages = {};
try {
  languages = JSON.parse(fs.readFileSync(languagesPath, 'utf8'));
} catch (err) {
  console.error('❌ Failed to load languages.json:', err.message);
  languages = { en: {} };
}

// Function to reload languages dynamically if file changes
function reloadLanguages() {
  try {
    languages = JSON.parse(fs.readFileSync(languagesPath, 'utf8'));
    return true;
  } catch (err) {
    console.error('❌ Error reloading languages.json:', err.message);
    return false;
  }
}

// Create a robust fallback proxy
function createLanguageProxy(langCode) {
  const currentDict = languages[langCode] || languages.en || {};
  const englishDict = languages.en || {};

  return new Proxy(currentDict, {
    get(target, prop) {
      if (typeof prop !== 'string') {
        return target[prop];
      }

      // 1. Direct match in active language
      if (prop in target && target[prop] !== undefined && target[prop] !== '') {
        return target[prop];
      }

      // 2. Fallback to English dictionary
      if (prop in englishDict && englishDict[prop] !== undefined && englishDict[prop] !== '') {
        return englishDict[prop];
      }

      // 3. Fallback to humanized string rather than undefined
      // e.g. "Total_Order_Volume" -> "Total Order Volume"
      if (typeof prop === 'string' && !['inspect', 'valueOf', 'toString', 'then', 'prototype', 'length'].includes(prop)) {
        return prop.replace(/_/g, ' ');
      }

      return target[prop];
    }
  });
}

const languageMiddleware = (req, res, next) => {
  const cookieLang = req.cookies.lang;
  let activeLang = 'en';

  if (cookieLang) {
    // Check if it's a JWT token
    try {
      const decoded = jwt.verify(cookieLang, process.env.TOKEN || 'safaefrtgdrefgstyrs');
      if (decoded && decoded.lang && languages[decoded.lang]) {
        activeLang = decoded.lang;
      }
    } catch (e) {
      // If not JWT, check if it's a direct code like 'es', 'ae', 'en'
      if (languages[cookieLang]) {
        activeLang = cookieLang;
      }
    }
  }

  const langProxy = createLanguageProxy(activeLang);

  // Attach to req for controllers
  req.language_data = langProxy;
  req.language_name = activeLang;
  req.isRTL = (activeLang === 'ae');

  // Attach globally to res.locals for ALL EJS templates
  res.locals.language = langProxy;
  res.locals.language_name = activeLang;
  res.locals.isRTL = (activeLang === 'ae');
  res.locals.langJson = JSON.stringify(languages[activeLang] || languages.en || {});
  res.locals.t = (key, fallback) => langProxy[key] || fallback || (key ? String(key).replace(/_/g, ' ') : '');

  next();
};

module.exports = {
  languageMiddleware,
  createLanguageProxy,
  reloadLanguages,
  languages
};
