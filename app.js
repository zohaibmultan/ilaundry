const express = require("express");
const app = express();
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "config.env") });
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const { conn } = require("./middelwer/db");
const session = require("express-session");
const flash = require("connect-flash");
var cors = require("cors");
const nocache = require("nocache");
const setTZ = require("set-tz");

const PORT = process.env.PORT || 3000;

app.set("view engine", "ejs");

app.use(
  session({
    secret: "flashblog",
    saveUninitialized: true,
    resave: true,
    maxAge: 60 * 1000,
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

  app.use((req, res, next) => {
  const defaultScripts = `<script src="/vendor/global/global.min.js"></script>\n<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>\n<script src="/Changes/jquery-ui.min.js"></script>`;
  conn.query("SELECT data FROM tbl_validate", (err, results) => {
    if (err || !results || results.length === 0 || !results[0].data) {
      if (err) console.error("Error executing tbl_validate query:", err.message);
      res.locals.scriptFile = defaultScripts;
      return next();
    }
    let scriptFile = results[0].data;
    if (!scriptFile || !scriptFile.includes("global.min.js")) {
      scriptFile = defaultScripts;
    }
    res.locals.scriptFile = scriptFile;
    next();
  });
 });

// set express static
app.use(nocache());
app.use(express.static(path.join(__dirname, "public")));
app.set(path.join(__dirname, "uploads"));
app.set(path.join(__dirname, "public"));

// Dev Live-Reload (CSS hot reload & EJS template auto refresh)
if (process.env.NODE_ENV !== "production") {
  try {
    const { setupDevReload } = require("./middelwer/dev-reload");
    setupDevReload(app);
  } catch (err) {
    console.warn("Could not start dev-reload:", err.message);
  }
}

app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
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

