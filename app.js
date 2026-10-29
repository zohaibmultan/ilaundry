const express = require("express");
const compression = require("compression");
const app = express();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config.env") });
const cookieParser = require("cookie-parser");
const { conn } = require("./middelwer/db");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const flash = require("connect-flash");
var cors = require("cors");
const setTZ = require("set-tz");

const PORT = process.env.PORT || 3000;

// Enable HTTP compression (Gzip/Deflate)
app.use(compression());

app.set("view engine", "ejs");
if (process.env.NODE_ENV === "production" && process.env.ENABLE_DEV_RELOAD !== "true") {
  app.set("view cache", true);
} else {
  app.set("view cache", false);
}

// Persistent MySQL Session Store to prevent memory leaks in shared hosting
const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 900000, // Clean up expired sessions every 15 mins
    expiration: 86400000,            // 1 day
    createDatabaseTable: true,
    schema: {
      tableName: "tbl_sessions",
    },
  },
  conn
);

let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret || !String(sessionSecret).trim()) {
  sessionSecret = require("crypto").randomBytes(32).toString("hex");
  console.warn("⚠️  SESSION_SECRET is not set in config.env — using a random per-process secret. Set it to keep sessions across restarts.");
}

app.use(
  session({
    key: "icleaners_sid",
    secret: sessionSecret,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "lax",
    },
  })
);

conn.query("SELECT timezone FROM tbl_master_shop where id=1", (err, row) => {
  if (err) {
    console.error("Database connection/query error fetching timezone:", err.message);
    return;
  }
  if (row && row.length > 0 && row[0].timezone) {
    setTZ(row[0].timezone);
  } else {
    console.warn("No timezone record found in tbl_master_shop, proceeding with default timezone.");
  }
});

const orderTypes = require("./public/js/shared/orderTypes");

app.use((req, res, next) => {
  res.locals.orderTypes = orderTypes;
  res.locals.scriptFile = `<script src="/vendor/global/global.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>\n<script src="/Changes/jquery-ui.min.js"></script>\n<script src="/js/shared/orderTypes.js"></script>`;
  res.locals.show_demo_accounts = process.env.show_demo_accounts !== undefined
    ? String(process.env.show_demo_accounts).trim().toLowerCase() === "true"
    : true;
  res.locals.enable_store_signup = process.env.enable_store_signup !== undefined
    ? String(process.env.enable_store_signup).trim().toLowerCase() === "true"
    : true;
  res.locals.devReload = (process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_RELOAD === "true");
  next();
});

// Static assets with browser caching
const staticMaxAge = process.env.NODE_ENV === "production" ? "7d" : 0;
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: staticMaxAge,
  etag: true,
  lastModified: true,
}));
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  maxAge: staticMaxAge,
  etag: true,
  lastModified: true,
}));

// Apply no-cache only to dynamic HTML / API routes, never to static files
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/uploads") && !req.path.startsWith("/vendor") && !req.path.startsWith("/css") && !req.path.startsWith("/js") && !req.path.startsWith("/images")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  next();
});

// Dev Live-Reload (CSS hot reload & EJS template auto refresh)
if (process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_RELOAD === "true") {
  try {
    const { setupDevReload } = require("./middelwer/dev-reload");
    setupDevReload(app);
  } catch (err) {
    console.warn("Could not start dev-reload:", err.message);
  }
} else {
  // Graceful no-op handlers for existing open browser tabs
  app.get("/dev-reload-stream", (req, res) => res.status(204).end());
  app.head("/dev-reload-stream", (req, res) => res.status(204).end());
}

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());
const { languageMiddleware } = require("./middelwer/language");
app.use(languageMiddleware);
app.use(flash());
app.use(cors());

app.use(function (req, res, next) {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  next();
});

app.use("/", require("./routers/login"));
app.use("/coustomer", require("./routers/coustomer"));
app.use("/expense", require("./routers/expense"));
app.use("/tool", require("./routers/tool"));
app.use("/services", require("./routers/services"));
app.use("/report", require("./routers/reports"));
app.use("/account", require("./routers/account"));
app.use("/app", require("./routers/app_login"));
app.use("/admin", require("./routers/pos"));
app.use("/coupon", require("./routers/coupon"));
app.use("/order", require("./routers/order"));

app.listen(PORT, () => {
  console.log(`server running on port http://localhost:${PORT}/`);
});

