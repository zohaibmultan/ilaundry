const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
const countryCodes = require("country-codes-list");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind,
} = require("../middelwer/databaseQurey");

router.get("/", async (req, res) => {
  try {
    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop where id=1",
    );

    let data = await DataFind("SELECT id FROM tbl_admin WHERE delet_flage=0");

    if (!data || data.length == 0) {
      try {
        const newroll = await DataInsert(
          `tbl_admin`,
          `name,number,email,username,password,store_ID,roll_id,approved,is_staff`,
          `'admin','12344556','admin@mail.com','admin','$2b$10$oxlEhLqJE80Z5L/4EsSRp.09xT6qs.qPbY9RyGyePryrBiyftHgRe',' ','','active','0'`,
          req.hostname,
          req.protocol,
        );

        if (newroll && newroll != -1) {
          const rollFind = await DataFind(
            `SELECT * FROM tbl_roll WHERE rollType = 'master' `,
          );

          if (rollFind && rollFind.length > 0) {
            const RollAdd = await DataInsert(
              `tbl_staff_roll`,
              `customers, orders, expense, service, reports, tools, mail, master, sms, staff, pos, rollaccess, account, coupon, branch_n_store, master_setting, Pay_Out, main_roll_id, staff_id, is_staff`,
              `'${rollFind[0].customer}', '${rollFind[0].orders}', '${rollFind[0].expense}', '${rollFind[0].service}', '${rollFind[0].reports}', '${rollFind[0].tools}', '${rollFind[0].mail}', 
              '${rollFind[0].master}', '${rollFind[0].sms}', '${rollFind[0].staff}', '${rollFind[0].pos}', '${rollFind[0].rollaccess}', '${rollFind[0].account}', '${rollFind[0].coupon}', 
              '${rollFind[0].branch_n_store}', '${rollFind[0].master_setting}', '${rollFind[0].Pay_Out}', '${rollFind[0].id}', '${newroll.insertId}', '0'`,
              req.hostname,
              req.protocol,
            );

            if (RollAdd && RollAdd != -1) {
              await DataFind(`
                UPDATE tbl_admin 
                SET roll_id = '${RollAdd.insertId}' 
                WHERE id = '${newroll.insertId}'
              `);
            }
          }
        }
      } catch (seedErr) {
        console.warn(
          "Auto-seeding default admin non-fatal error:",
          seedErr.message,
        );
      }
    }

    let rollverify = await DataFind(`SELECT * FROM tbl_roll`);

    const show_demo_accounts = process.env.show_demo_accounts !== undefined
      ? String(process.env.show_demo_accounts).trim().toLowerCase() === "true"
      : true;
    const enable_store_signup = process.env.enable_store_signup !== undefined
      ? String(process.env.enable_store_signup).trim().toLowerCase() === "true"
      : true;

    let demo_users = [];
    if (show_demo_accounts) {
      try {
        demo_users = (await DataFind(
          `SELECT a.id, a.username, a.name, a.email, a.number, a.store_ID, a.roll_id, a.is_staff,
                  s.name AS store_name,
                  r.roll AS role_name
           FROM tbl_admin a
           LEFT JOIN tbl_store s ON s.id = a.store_ID
           LEFT JOIN tbl_roll r ON r.id = a.roll_id
           WHERE a.delet_flage = 0 AND a.approved = 1 AND a.username IS NOT NULL AND LENGTH(a.username) > 0
           ORDER BY a.id ASC`
        )) || [];
      } catch (demoErr) {
        console.warn("Failed to fetch demo users:", demoErr.message);
        demo_users = [];
      }
    }

    res.render("login", {
      data: masterstore && masterstore.length > 0 ? masterstore[0] : {},
      rollverify: rollverify || [],
      show_demo_accounts,
      enable_store_signup,
      demo_users,
    });
  } catch (err) {
    console.error("Root / route error:", err);
    res.render("login", {
      data: {},
      rollverify: [],
      show_demo_accounts: true,
      enable_store_signup: true,
      demo_users: [],
    });
  }
});

router.get("/validate", async (req, res) => {
  return res.redirect("/");
});

// <<<<<<<<<<<<<<<<<<<< Forgot Password & Reset Password Routes >>>>>>>>>>>>>>>>>>>>
router.get("/forgot-password", async (req, res) => {
  try {
    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop WHERE id=1",
    );
    res.render("forgot_password", {
      data: masterstore && masterstore.length > 0 ? masterstore[0] : {},
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.log(error);
    res.redirect("/");
  }
});

router.post("/forgot-password", async (req, res) => {
  try {
    const { identifier } = req.body;
    if (!identifier || !identifier.trim()) {
      req.flash("error", "Please enter a valid Username or Email address.");
      return res.redirect("/forgot-password");
    }

    const cleanIdentifier = identifier.trim().replace(/'/g, "\\'");

    // 1. Search in tbl_customer
    let user = await DataFind(
      `SELECT id, username, email, name FROM tbl_customer WHERE (username='${cleanIdentifier}' OR email='${cleanIdentifier}') AND delet_flage=0`,
    );
    let table = "tbl_customer";

    // 2. If not found in tbl_customer, search in tbl_admin
    if (user.length === 0) {
      user = await DataFind(
        `SELECT id, username, email, name FROM tbl_admin WHERE (username='${cleanIdentifier}' OR email='${cleanIdentifier}') AND delet_flage=0`,
      );
      table = "tbl_admin";
    }

    if (user.length === 0) {
      req.flash(
        "error",
        "No account found registered with that Username or Email.",
      );
      return res.redirect("/forgot-password");
    }

    // Generate secure token (valid for 1 hour)
    const token = crypto.randomBytes(32).toString("hex");

    await DataFind(
      `UPDATE ${table} SET reset_token='${token}', reset_token_expires=DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id=${user[0].id}`,
    );

    const resetUrl = `${req.protocol}://${req.get("host")}/reset-password?token=${token}`;

    // Attempt to dispatch email if tbl_mail is configured
    const mailConfig = await DataFind("SELECT * FROM tbl_mail WHERE id=1");
    let emailSent = false;

    if (
      mailConfig.length > 0 &&
      mailConfig[0].host &&
      mailConfig[0].username &&
      mailConfig[0].password &&
      mailConfig[0].frommail &&
      user[0].email
    ) {
      try {
        const transporter = nodemailer.createTransport({
          host: mailConfig[0].host,
          port: Number(mailConfig[0].port) || 587,
          secure: Number(mailConfig[0].port) === 465,
          auth: {
            user: mailConfig[0].username,
            pass: mailConfig[0].password,
          },
        });

        await transporter.sendMail({
          from: mailConfig[0].frommail,
          to: user[0].email,
          subject: "Password Reset Request",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0081EE; margin-bottom: 12px;">Password Reset Request</h2>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">Hello <strong>${user[0].name || user[0].username}</strong>,</p>
              <p style="color: #334155; font-size: 15px; line-height: 1.5;">We received a request to reset your account password. Click the button below to choose a new password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #0081EE; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Reset My Password</a>
              </div>
              <p style="color: #64748b; font-size: 13px;">This link will expire in 1 hour. If you did not make this request, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;">
              <p style="color: #94a3b8; font-size: 11px;">If the button doesn't work, copy and paste this URL into your browser:<br>${resetUrl}</p>
            </div>
          `,
        });
        emailSent = true;
      } catch (mailErr) {
        console.log(
          "Mail dispatch error (fallback will be shown):",
          mailErr.message,
        );
      }
    }

    if (emailSent) {
      req.flash(
        "success",
        `A password reset link has been dispatched to ${user[0].email}. Please check your inbox.`,
      );
    } else {
      req.flash(
        "success",
        `Password reset link generated! <a href="/reset-password?token=${token}" class="fw-bold text-primary text-decoration-underline ms-1">Click here to set your new password &rarr;</a>`,
      );
    }

    return res.redirect("/forgot-password");
  } catch (error) {
    console.log(error);
    req.flash("error", "An unexpected error occurred. Please try again.");
    return res.redirect("/forgot-password");
  }
});

router.get("/reset-password", async (req, res) => {
  try {
    const { token } = req.query;
    if (!token || !token.trim()) {
      req.flash("error", "Missing or invalid password reset token.");
      return res.redirect("/forgot-password");
    }

    const cleanToken = token.trim().replace(/'/g, "\\'");
    let user = await DataFind(
      `SELECT id, username, email, name FROM tbl_customer WHERE reset_token='${cleanToken}' AND reset_token_expires > NOW() AND delet_flage=0`,
    );

    if (user.length === 0) {
      user = await DataFind(
        `SELECT id, username, email, name FROM tbl_admin WHERE reset_token='${cleanToken}' AND reset_token_expires > NOW() AND delet_flage=0`,
      );
    }

    if (user.length === 0) {
      req.flash(
        "error",
        "This password reset link is invalid or has expired. Please request a new one.",
      );
      return res.redirect("/forgot-password");
    }

    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop WHERE id=1",
    );

    res.render("reset_password", {
      data: masterstore && masterstore.length > 0 ? masterstore[0] : {},
      token: cleanToken,
      user: user[0],
      success: req.flash("success"),
      error: req.flash("error"),
    });
  } catch (error) {
    console.log(error);
    res.redirect("/forgot-password");
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirm_password } = req.body;

    if (!token || !token.trim()) {
      req.flash("error", "Missing reset token.");
      return res.redirect("/forgot-password");
    }

    if (!password || password.length < 4) {
      req.flash("error", "Password must be at least 4 characters long.");
      return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
    }

    if (password !== confirm_password) {
      req.flash("error", "New password and Confirm password do not match.");
      return res.redirect(`/reset-password?token=${encodeURIComponent(token)}`);
    }

    const cleanToken = token.trim().replace(/'/g, "\\'");

    let user = await DataFind(
      `SELECT id FROM tbl_customer WHERE reset_token='${cleanToken}' AND reset_token_expires > NOW() AND delet_flage=0`,
    );
    let table = "tbl_customer";

    if (user.length === 0) {
      user = await DataFind(
        `SELECT id FROM tbl_admin WHERE reset_token='${cleanToken}' AND reset_token_expires > NOW() AND delet_flage=0`,
      );
      table = "tbl_admin";
    }

    if (user.length === 0) {
      req.flash(
        "error",
        "Password reset session has expired or is invalid. Please submit a new request.",
      );
      return res.redirect("/forgot-password");
    }

    const hashedPassword = bcrypt.hashSync(password, 10);

    await DataFind(
      `UPDATE ${table} SET password='${hashedPassword}', reset_token=NULL, reset_token_expires=NULL WHERE id=${user[0].id}`,
    );

    req.flash(
      "success",
      "Password updated successfully! You can now sign in with your new password.",
    );
    return res.redirect("/");
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while resetting password.");
    return res.redirect("/forgot-password");
  }
});

// login post router
router.post("/login", async (req, res) => {
  try {
    // await DataFind("UPDATE tbl_admin SET approved = 1 WHERE id=34")
    const { username, password } = req.body;
    // console.log('loginas', loginas);
    let loginas = 0;
    // if (loginas == 0) {
    //   var qury =
    //     "SELECT * FROM tbl_customer WHERE username='" +
    //     username +
    //     "' AND delet_flage=0 AND approved=1";
    // } else {
    //   var qury =
    //     "SELECT * FROM tbl_admin WHERE username='" +
    //     username +
    //     "' AND delet_flage=0 AND approved=1";
    // }

    let data = await DataFind(
      "SELECT * FROM tbl_customer WHERE username='" +
        username +
        "' OR email = '" +
        username +
        "' OR number = '" +
        username +
        "' AND delet_flage=0 AND approved=1",
    );
    // console.log(111111, data);

    if (data.length == 0) {
      loginas = 1;
      data = await DataFind(
        "SELECT * FROM tbl_admin WHERE username='" +
          username +
          "' OR email = '" +
          username +
          "' OR number = '" +
          username +
          "'  AND delet_flage=0",
      );
      console.log(data);

      if (data.length > 0 && data[0].approved == "0") {
        req.flash("error", `${data[0].name} is not approved`);
        return res.redirect(req.get("Referrer") || "/");
      }

      if (data.length > 0) {
        rollFind = await DataFind(
          `SELECT r.* FROM tbl_staff_roll sr JOIN tbl_roll AS r ON r.id = sr.main_roll_id WHERE sr.staff_id = '${data[0].id}' `,
        );

        console.log("rollFind", rollFind);

        if (rollFind.length > 0 && rollFind[0].roll_status === "deactive") {
          req.flash(
            "error",
            `${
              rollFind[0].roll.charAt(0).toUpperCase() +
              rollFind[0].roll.slice(1)
            } is deactive`,
          );
          return res.redirect(req.get("Referrer") || "/");
        }
      }

      if (data.length == 0) {
        req.flash("error", "Wrong user name!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
      let isValidPass = bcrypt.compareSync(password, data[0].password);
      console.log("isValidPass", isValidPass);
      console.log("password", password);
      console.log("data[0].password", data[0].password);

      if (!isValidPass) {
        req.flash("error", "Wrong Password!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
    }

    if (data.length > 0 && data[0].approved == "0") {
      req.flash("error", `${data[0].name} is not approved`);
      return res.redirect(req.get("Referrer") || "/");
    }

    if (data.length == 0) {
      req.flash("error", "Wrong user name!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    if (data[0].password.length > 0) {
      let isValidPass = bcrypt.compareSync(password, data[0].password);
      console.log("isValidPass", isValidPass);
      console.log("password", password);
      console.log("data[0].password", data[0].password);

      if (!isValidPass) {
        req.flash("error", "Wrong Password!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
    }
    if (loginas == 0) {
      rollFind = await DataFind(
        `SELECT * FROM  tbl_roll  WHERE id = ${data[0].main_roll_id}`,
      );

      console.log("rollFind", rollFind);

      if (rollFind.length > 0 && rollFind[0].roll_status === "deactive") {
        req.flash(
          "error",
          `${
            rollFind[0].roll.charAt(0).toUpperCase() + rollFind[0].roll.slice(1)
          } is deactive`,
        );
        return res.redirect(req.get("Referrer") || "/");
      }
      var token = await jwt.sign(
        { id: data[0].id, roll: 0, store: data[0].store_ID, loginas },
        process.env.TOKEN_KEY,
      );
    } else {
      var token = await jwt.sign(
        {
          id: data[0].id,
          roll: data[0].roll_id,
          store: data[0].store_ID,
          loginas,
        },
        process.env.TOKEN_KEY,
      );
    }

    res.cookie("webtoken", token, {
      expires: new Date(Date.now() + 1000 * 60 * 60),
      httpOnly: true,
    });

    const lang = req.cookies.lang;

    if (lang == undefined) {
      const lang_data = jwt.sign({ lang: "en" }, process.env.TOKEN);
      res.cookie("lang", lang_data, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60 * 1000,
      });
    }

    req.flash("success", `${data[0].name}, Welcome back!!`);
    if (loginas == 0) {
      console.log(rollFind);

      if (rollFind[0].pos.includes("read")) {
        res.redirect("/admin/pos");
      } else if (rollFind[0].orders.includes("read")) {
        res.redirect("/order/list");
      } else if (rollFind[0].customer.includes("read")) {
        res.redirect("/coustomer/list");
      } else {
        res.redirect("/profile");
      }
    } else {
      res.redirect("/index");
    }
  } catch (error) {
    console.log(error);
  }
});

// customer register render router
router.get("/register", async (req, res) => {
  const data = await DataFind(
    "SELECT type , customer_selection FROM tbl_master_shop",
  );
  const masterstore = await DataFind(
    "SELECT * FROM tbl_master_shop where id=1",
  );

  const Country_name = countryCodes.customList("countryCode", "{countryCode}");
  const nameCode = Object.values(Country_name);

  const myCountryCodesObject = countryCodes.customList(
    "countryCode",
    "+{countryCallingCode}",
  );
  const CountryCode = Object.values(myCountryCodesObject);

  if (data[0].type == 1) {
    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status= 1",
    );

    if (storeList.length == 0) {
      req.flash("error", "Currently, no stores are available.");
      return res.redirect(req.get("Referrer") || "/");
    }
    let multiy = "";
    if (data[0].customer_selection == 1) {
      multiy = true;
    } else {
      multiy = false;
    }
    console.log(multiy);

    res.render("register", {
      multiy: multiy,
      store: storeList,
      data: masterstore[0],
      nameCode,
      CountryCode,
    });
  } else {
    res.render("register", {
      multiy: false,
      store: [],
      data: masterstore[0],
      nameCode,
      CountryCode,
    });
  }
});

// store register render router
router.get("/shopregister", async (req, res) => {
  const isStoreSignupEnabled = process.env.enable_store_signup !== undefined
    ? String(process.env.enable_store_signup).trim().toLowerCase() === "true"
    : true;
  if (!isStoreSignupEnabled) {
    return res.redirect("/");
  }

  const masterstore = await DataFind(
    "SELECT * FROM tbl_master_shop where id=1",
  );
  const Country_name = countryCodes.customList("countryCode", "{countryCode}");
  const nameCode = Object.values(Country_name);

  const myCountryCodesObject = countryCodes.customList(
    "countryCode",
    "+{countryCallingCode}",
  );
  const CountryCode = Object.values(myCountryCodesObject);
  res.render("shop_self_register", {
    data: masterstore[0],
    nameCode,
    CountryCode,
  });
});

// customer register post router
router.post("/register", async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      name,
      number,
      email,
      taxnumber,
      address,
      username,
      password,
      store,
    } = req.body;

    let fName = (first_name || '').trim();
    let lName = (last_name || '').trim();
    if (!fName && !lName && name) {
      const raw = name.trim();
      if (raw.includes(',')) {
        const parts = raw.split(',');
        lName = parts[0].trim();
        fName = parts.slice(1).join(',').trim();
      } else {
        const parts = raw.split(/\s+/);
        fName = parts[0] || '';
        lName = parts.slice(1).join(' ') || '';
      }
    }
    let combinedName = (lName && fName) ? `${lName}, ${fName}` : (lName || fName || (name ? name.trim() : ''));

    const safeFirstName = fName.replace(/'/g, "\\'");
    const safeLastName = lName.replace(/'/g, "\\'");
    const safeName = combinedName.replace(/'/g, "\\'");
    const safeNumber = (number || '').trim().replace(/'/g, "\\'");
    const safeEmail = (email || '').trim().replace(/'/g, "\\'");
    const safeAddress = (address || '').trim().replace(/'/g, "\\'");
    const safeTaxNumber = (taxnumber || '').trim().replace(/'/g, "\\'");
    const safeUsername = (username || '').trim().replace(/'/g, "\\'");

    const check_number = await DataFind(
      "SELECT * FROM tbl_customer WHERE number='" + safeNumber + "'",
    );

    if (check_number.length > 0) {
      req.flash("error", "This Mobile Number Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const check_username = await DataFind(
      "SELECT * FROM tbl_customer WHERE username='" + safeUsername + "'",
    );

    if (check_username.length > 0) {
      req.flash("error", "This UserName Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const autoApproval = await DataFind(
      "SELECT customer_autoapprove FROM tbl_master_shop where id=1",
    );

    if (autoApproval[0].customer_autoapprove == 1) {
      var approved = 1;
    } else {
      var approved = 0;
    }

    let customerId = await DataFind(
      `SELECT * FROM tbl_roll WHERE rollType='customer'`,
    );

    const salt = bcrypt.genSaltSync(10);
    const hashpass = bcrypt.hashSync(password, salt);

    if (store) {
      const customerInsert = await DataInsert(
        `tbl_customer`,
        `name,first_name,last_name,number,email,address,taxnumber,username,password,main_roll_id,approved,store_ID`,
        `'${safeName}','${safeFirstName}','${safeLastName}','${safeNumber}','${safeEmail}','${safeAddress}','${safeTaxNumber}','${safeUsername}','${hashpass}','${customerId[0].id}',${approved},'${store}'`,
        req.hostname,
        req.protocol,
      );

      if (customerInsert == -1) {
        req.flash(
          "error",
          "Registration failed, please check input and try again",
        );
        return res.redirect("back");
      }
    } else {
      const customerInsert = await DataInsert(
        `tbl_customer`,
        `name,first_name,last_name,number,email,address,taxnumber,username,password,main_roll_id,approved`,
        `'${safeName}','${safeFirstName}','${safeLastName}','${safeNumber}','${safeEmail}','${safeAddress}','${safeTaxNumber}','${safeUsername}','${hashpass}','${customerId[0].id}',${approved}`,
        req.hostname,
        req.protocol,
      );

      if (customerInsert == -1) {
        req.flash(
          "error",
          "Registration failed, please check input and try again",
        );
        return res.redirect("back");
      }
    }

    // const data = await DataFind(qury);
    req.flash(
      "success",
      "Your information will be sent to the administration for approval.!",
    );
    res.redirect("/");
  } catch (error) {
    console.log(error);
  }
});

// store register post router
router.post("/shopregister", upload.single("logo"), async (req, res) => {
  try {
    const isStoreSignupEnabled = process.env.enable_store_signup !== undefined
      ? String(process.env.enable_store_signup).trim().toLowerCase() === "true"
      : true;
    if (!isStoreSignupEnabled) {
      return res.redirect("/");
    }

    const {
      name,
      number,
      store_email,
      state,
      city,
      tax_number,
      username,
      password,
      commission,
      taxpercent,
      country,
      district,
      zip_code,
      address,
      contact_first_name,
      contact_last_name,
      contact_phone,
      contact_email,
    } = req.body;
    const checkname = await DataFind(
      "SELECT * FROM tbl_store WHERE name='" + name + "'",
    );
    if (checkname.length > 0) {
      req.flash("error", "This Store Name Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const checknumber = await DataFind(
      "SELECT * FROM tbl_store WHERE mobile_number='" + number + "'",
    );
    if (checknumber.length > 0) {
      req.flash("error", "This Number Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const checkstore_email = await DataFind(
      "SELECT * FROM tbl_store WHERE store_email='" + store_email + "'",
    );
    if (checkstore_email.length > 0) {
      req.flash("error", "This Email Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    var logo = req.file ? req.file.filename : "";
    const autoApproval = await DataFind(
      "SELECT store_autoapprove,storeroll FROM tbl_master_shop where id=1",
    );
    const isAutoApproved =
      autoApproval.length > 0 && autoApproval[0].store_autoapprove == 1;
    const approvedStatus = isAutoApproved ? 1 : 0;

    let targetRoll = null;
    if (autoApproval.length > 0 && autoApproval[0].storeroll) {
      const customRoll = await DataFind(
        `SELECT * FROM tbl_roll WHERE id = '${autoApproval[0].storeroll}' AND delet_flage = 0`,
      );
      if (customRoll.length > 0 && customRoll[0].rollType === "store") {
        targetRoll = customRoll[0];
      }
    }
    if (!targetRoll) {
      const defaultStoreRoll = await DataFind(
        `SELECT * FROM tbl_roll WHERE rollType = 'store' AND delet_flage = 0 ORDER BY id ASC LIMIT 1`,
      );
      if (defaultStoreRoll.length > 0) {
        targetRoll = defaultStoreRoll[0];
      }
    }
    const targetRollId = targetRoll ? targetRoll.id : 13;

    const salt = bcrypt.genSaltSync(10);
    const hashpass = bcrypt.hashSync(password, salt);

    const admindata = await DataInsert(
      `tbl_admin`,
      `name,number,email,username,password,store_ID,roll_id,approved,is_staff`,
      `'${name}','${number}','${store_email}','${username}','${hashpass}','',0,${approvedStatus},'0'`,
      req.hostname,
      req.protocol,
    );

    if (admindata == -1) {
      req.flash(
        "error",
        "Failed to create shop admin, please check input and try again",
      );
      return res.redirect("back");
    }

    var newid = admindata.insertId;

    const safeContactFName = (contact_first_name || "").trim().replace(/'/g, "\\'");
    const safeContactLName = (contact_last_name || "").trim().replace(/'/g, "\\'");
    const safeContactPhone = (contact_phone || "").trim().replace(/'/g, "\\'");
    const safeContactEmail = (contact_email || "").trim().replace(/'/g, "\\'");

    const storedata = await DataInsert(
      `tbl_store`,
      `name,logo,mobile_number,username,password,shop_commission,tax_percent,country,state,city,district,zipcode,store_email,store_tax_number,address,admin_id,status,roll_id,contact_first_name,contact_last_name,contact_phone,contact_email`,
      `'${name}','${logo}','${number}','${username}','${hashpass}',0,0,'${country || " "}','${state || " "}','${city || " "}','${district || " "}','${zip_code || " "}','${store_email}','${tax_number || " "}','${address || " "}',${newid},${approvedStatus},${targetRollId},'${safeContactFName}','${safeContactLName}','${safeContactPhone}','${safeContactEmail}'`,
      req.hostname,
      req.protocol,
    );

    if (storedata == -1) {
      req.flash(
        "error",
        "Failed to create store record, please check input and try again",
      );
      return res.redirect("back");
    }

    // Create staff_roll record for complete store management permissions
    const customersPerm = targetRoll?.customers || "read,write,edit,delete";
    const ordersPerm = targetRoll?.orders || "read,write,edit,delete";
    const expensePerm = targetRoll?.expense || "read,write,edit,delete";
    const servicePerm = targetRoll?.service || "read,write,edit,delete";
    const reportsPerm = targetRoll?.reports || "read";
    const toolsPerm = targetRoll?.tools || "read";
    const mailPerm = targetRoll?.mail || "read,edit";
    const masterPerm = targetRoll?.master || "read,edit";
    const smsPerm = targetRoll?.sms || "read,write,edit,delete";
    const staffPerm = targetRoll?.staff || "read,write,edit,delete";
    const posPerm = targetRoll?.pos || "read,write,edit";
    const accountPerm = targetRoll?.account || "read,write,edit,delete";
    const couponPerm = "read,write,edit,delete";

    const staffRollInsert = await DataInsert(
      `tbl_staff_roll`,
      `customers, orders, expense, service, reports, tools, mail, master, sms, staff, pos, rollaccess, account, coupon, branch_n_store, master_setting, Pay_Out, main_roll_id, staff_id, is_staff`,
      `'${customersPerm}', '${ordersPerm}', '${expensePerm}', '${servicePerm}', '${reportsPerm}', '${toolsPerm}', '${mailPerm}', '${masterPerm}', '${smsPerm}', '${staffPerm}', '${posPerm}', '', '${accountPerm}', '${couponPerm}', '', '', '', '${targetRollId}', '${newid}', '0'`,
      req.hostname,
      req.protocol,
    );

    const staffRollId =
      staffRollInsert && staffRollInsert != -1
        ? staffRollInsert.insertId
        : targetRollId;

    await DataUpdate(
      "tbl_admin",
      `store_ID=${storedata.insertId}, roll_id=${staffRollId}, approved=${approvedStatus}`,
      `id=${newid}`,
      req.hostname,
      req.protocol,
    );

    // Create Walk-in customer for the new store
    await DataInsert(
      `tbl_customer`,
      `name,store_ID,reffstore,approved,delet_flage`,
      `'Walk in customer','${storedata.insertId}','1','1','0'`,
      req.hostname,
      req.protocol,
    );

    if (isAutoApproved) {
      req.flash(
        "success",
        "Store registration successful! You can now sign in with your credentials.",
      );
    } else {
      req.flash(
        "success",
        "Your store registration has been received and will be sent to the administration for approval!",
      );
    }
    res.redirect("/");
  } catch (error) {
    console.log(error);
    req.flash(
      "error",
      "An error occurred during registration. Please try again.",
    );
    res.redirect("back");
  }
});

// home page
router.get("/index", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;

    const accessdata = await access(req.user);

    const rolldetail = await DataFind(`
      SELECT 
        sr.*, 
        r.roll_status, 
        r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (!rolldetail || rolldetail.length === 0) {
      req.flash("error", "Staff role not found. Please contact administrator.");
      return res.redirect("/");
    }

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const userStoreId =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID).trim() !== "" &&
      String(adminData[0].store_ID).trim() !== "0"
        ? String(adminData[0].store_ID).trim()
        : store && String(store).trim() !== "" && String(store).trim() !== "0"
          ? String(store).trim()
          : null;

    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const isStoreRole =
      rolldetail && rolldetail.length > 0 && rolldetail[0].rollType === "store";
    const isStoreScoped =
      Boolean(userStoreId) && (isStaff || isStoreRole || Boolean(userStoreId));
    const activeStoreId = isStoreScoped ? userStoreId : null;

    let storeName = "";
    if (activeStoreId) {
      const sName = await DataFind(
        `SELECT name FROM tbl_store WHERE id = '${activeStoreId}'`,
      );
      if (sName.length > 0) storeName = sName[0].name;
    }

    if (isStaff) {
      const canAccessPos = Boolean(
        rolldetail[0]?.pos &&
        (rolldetail[0].pos.includes("read") || rolldetail[0].pos.includes("write"))
      );
      const canReadOrders = Boolean(rolldetail[0]?.orders && rolldetail[0].orders.includes("read"));
      const canReadReports = Boolean(rolldetail[0]?.reports && rolldetail[0].reports.includes("read"));

      const staffStats = await DataFind(`
        SELECT 
          COALESCE(SUM(CASE WHEN order_status != '6' THEN gross_total ELSE 0 END), 0) AS staff_sales,
          COUNT(CASE WHEN order_status != '6' THEN id ELSE NULL END) AS staff_orders
        FROM tbl_order
        WHERE (created_by = '1,${id}' OR created_by = '${id}')
      `);

      const recentOrder = await DataFind(`
        SELECT tbl_order.order_id, tbl_order.id, tbl_order.order_date, tbl_order.gross_total, tbl_order.paid_amount, tbl_order.store_id, tbl_order.order_status, tbl_customer.name as customer, tbl_orderstatus.status, tbl_store.name as store
        FROM tbl_order
        JOIN tbl_customer ON tbl_order.customer_id = tbl_customer.id  
        JOIN tbl_orderstatus ON tbl_order.order_status = tbl_orderstatus.id 
        LEFT JOIN tbl_store ON tbl_order.store_id = tbl_store.id 
        WHERE (tbl_order.created_by = '1,${id}' OR tbl_order.created_by = '${id}')
        ORDER BY tbl_order.id DESC 
        LIMIT 10
      `);

      return res.render("staff_dashboard", {
        accessdata,
        data: {
          totalorder: staffStats[0]?.staff_orders || 0,
          tottalsales: staffStats[0]?.staff_sales || 0,
        },
        recentOrder: recentOrder || [],
        roll: rolldetail[0],
        language: req.language_data,
        language_name: req.language_name,
        storeName,
        isStaff: true,
        canAccessPos,
        canReadOrders,
        canReadReports
      });
    }

    if (isStoreScoped && activeStoreId) {
      // Store view: strictly scoped to assigned store (both store user and staff)
      const storeStats = await DataFind(`
        SELECT 
          (SELECT COALESCE(SUM(gross_total), 0) FROM tbl_order WHERE store_id = '${activeStoreId}' AND order_status != '6') AS tottalsales,
          (SELECT COUNT(*) FROM tbl_order WHERE store_id = '${activeStoreId}' AND order_status != '6') AS totalorder,
          (SELECT COUNT(*) FROM tbl_services WHERE store_ID = '${activeStoreId}') AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE store_ID = '${activeStoreId}' AND approved = '1' AND delet_flage != '1' AND name != 'Walk in Customer') AS totalcustomer
      `);

      const recentOrder = await DataFind(`
        SELECT tbl_order.order_id, tbl_order.id, tbl_order.gross_total, tbl_order.paid_amount, tbl_order.store_id, tbl_order.order_status, tbl_customer.name as customer, tbl_orderstatus.status, tbl_store.name as store
        FROM tbl_order
        JOIN tbl_customer ON tbl_order.customer_id = tbl_customer.id  
        JOIN tbl_orderstatus ON tbl_order.order_status = tbl_orderstatus.id 
        JOIN tbl_store ON tbl_order.store_id = tbl_store.id 
        WHERE tbl_order.store_id = '${activeStoreId}'
        ORDER BY tbl_order.id DESC 
        LIMIT 10
      `);

      const chartOrders = await DataFind(`
        SELECT id, order_date, gross_total 
        FROM tbl_order 
        WHERE store_id = '${activeStoreId}' AND YEAR(order_date) = YEAR(CURDATE()) AND order_status != '6'
      `);

      let orderfunction = await groupOrdersByYearAndMonth(chartOrders);
      let countorder = orderfunction.totorder;
      let countsales = orderfunction.totsales;

      return res.render("index", {
        accessdata,
        data: storeStats[0] || {
          tottalsales: 0,
          totalorder: 0,
          totalservices: 0,
          totalcustomer: 0,
        },
        recentOrder,
        roll: rolldetail[0],
        language: req.language_data,
        language_name: req.language_name,
        countorder,
        countsales,
        isStoreScoped: true,
        isStaff,
        staffStoreId: activeStoreId,
        staffStoreName: storeName,
        storeName,
        storeStatsList: [],
        storeList: [],
      });
    } else {
      // Super Admin view: overall totals across all stores + per-store stats + top 10 orders across all stores with store name
      const overallStats = await DataFind(`
        SELECT 
          (SELECT COALESCE(SUM(gross_total), 0) FROM tbl_order WHERE order_status != '6') AS tottalsales,
          (SELECT COUNT(*) FROM tbl_order WHERE order_status != '6') AS totalorder,
          (SELECT COUNT(*) FROM tbl_services) AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE delet_flage != '1' AND approved = '1' AND name != 'Walk in Customer') AS totalcustomer
      `);

      const storeList = await DataFind(
        "SELECT id, name FROM tbl_store WHERE status = 1 AND delete_flage = 0 ORDER BY id ASC",
      );

      const storeStatsList = await DataFind(`
        SELECT 
          s.id AS store_id,
          s.name AS store_name,
          COALESCE(SUM(CASE WHEN o.order_status != '6' THEN o.gross_total ELSE 0 END), 0) AS tottalsales,
          COUNT(DISTINCT CASE WHEN o.order_status != '6' THEN o.id ELSE NULL END) AS totalorder,
          (SELECT COUNT(*) FROM tbl_services WHERE store_ID = s.id) AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE store_ID = s.id AND delet_flage != '1' AND approved = '1' AND name != 'Walk in Customer') AS totalcustomer
        FROM tbl_store s
        LEFT JOIN tbl_order o ON s.id = o.store_id
        WHERE s.status = 1 AND s.delete_flage = 0
        GROUP BY s.id, s.name
        ORDER BY s.id ASC
      `);

      const recentOrder = await DataFind(`
        SELECT tbl_order.order_id, tbl_order.id, tbl_order.gross_total, tbl_order.paid_amount, tbl_order.store_id, tbl_order.order_status, tbl_customer.name as customer, tbl_orderstatus.status, tbl_store.name as store 
        FROM tbl_order 
        JOIN tbl_customer ON tbl_order.customer_id = tbl_customer.id 
        JOIN tbl_orderstatus ON tbl_order.order_status = tbl_orderstatus.id 
        LEFT JOIN tbl_store ON tbl_order.store_id = tbl_store.id 
        ORDER BY tbl_order.id DESC 
        LIMIT 10
      `);

      const chartOrders = await DataFind(`
        SELECT id, order_date, gross_total 
        FROM tbl_order 
        WHERE YEAR(order_date) = YEAR(CURDATE()) AND order_status != '6'
      `);

      let orderfunction = await groupOrdersByYearAndMonth(chartOrders);
      let countorder = orderfunction.totorder;
      let countsales = orderfunction.totsales;

      return res.render("index", {
        accessdata,
        data: overallStats[0] || {
          tottalsales: 0,
          totalorder: 0,
          totalservices: 0,
          totalcustomer: 0,
        },
        recentOrder,
        roll: rolldetail[0],
        language: req.language_data,
        language_name: req.language_name,
        countorder,
        countsales,
        isStoreScoped: false,
        isStaff: false,
        staffStoreId: null,
        staffStoreName: "",
        storeName: "",
        storeStatsList,
        storeList,
      });
    }
  } catch (err) {
    console.error("Error in /index:", err);
    req.flash("error", "Internal Server Error");
    return res.redirect("/");
  }
});

router.get("/api/dashboard-stats", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const userStoreId =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID).trim() !== "" &&
      String(adminData[0].store_ID).trim() !== "0"
        ? String(adminData[0].store_ID).trim()
        : store && String(store).trim() !== "" && String(store).trim() !== "0"
          ? String(store).trim()
          : null;

    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;

    if (isStaff) {
      const staffStats = await DataFind(`
        SELECT 
          COALESCE(SUM(CASE WHEN order_status != '6' THEN gross_total ELSE 0 END), 0) AS tottalsales,
          COUNT(CASE WHEN order_status != '6' THEN id ELSE NULL END) AS totalorder
        FROM tbl_order
        WHERE (created_by = '1,${id}' OR created_by = '${id}')
      `);

      return res.status(200).json({
        success: true,
        data: staffStats[0] || { tottalsales: 0, totalorder: 0 },
        isStaff: true
      });
    }

    let isStoreRole = false;
    if (roll) {
      const rolldetail = await DataFind(`
        SELECT r.rollType 
        FROM tbl_staff_roll sr
        JOIN tbl_roll r ON sr.main_roll_id = r.id
        WHERE sr.id = ${roll}
      `);
      if (rolldetail.length > 0 && rolldetail[0].rollType === "store") {
        isStoreRole = true;
      }
    }

    const isStoreScoped =
      Boolean(userStoreId) && (isStaff || isStoreRole || Boolean(userStoreId));
    let targetStore = req.query.store_id;

    if (isStoreScoped) {
      targetStore = userStoreId;
    }

    let statsQuery;
    if (targetStore && targetStore !== "0" && targetStore !== "all") {
      statsQuery = `
        SELECT 
          (SELECT COALESCE(SUM(gross_total), 0) FROM tbl_order WHERE store_id = '${targetStore}' AND order_status != '6') AS tottalsales,
          (SELECT COUNT(*) FROM tbl_order WHERE store_id = '${targetStore}' AND order_status != '6') AS totalorder,
          (SELECT COUNT(*) FROM tbl_services WHERE store_ID = '${targetStore}') AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE (store_ID = '${targetStore}' OR reffstore = '${targetStore}') AND delet_flage != '1') AS totalcustomer
      `;
    } else {
      statsQuery = `
        SELECT 
          (SELECT COALESCE(SUM(gross_total), 0) FROM tbl_order WHERE order_status != '6') AS tottalsales,
          (SELECT COUNT(*) FROM tbl_order WHERE order_status != '6') AS totalorder,
          (SELECT COUNT(*) FROM tbl_services) AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE delet_flage != '1') AS totalcustomer
      `;
    }

    const totalsele = await DataFind(statsQuery);
    const stats =
      totalsele && totalsele[0]
        ? totalsele[0]
        : { tottalsales: 0, totalorder: 0, totalservices: 0, totalcustomer: 0 };

    let storeStatsList = [];
    if (!isStoreScoped) {
      storeStatsList = await DataFind(`
        SELECT 
          s.id AS store_id,
          s.name AS store_name,
          COALESCE(SUM(CASE WHEN o.order_status != '6' THEN o.gross_total ELSE 0 END), 0) AS tottalsales,
          COUNT(DISTINCT CASE WHEN o.order_status != '6' THEN o.id ELSE NULL END) AS totalorder,
          (SELECT COUNT(*) FROM tbl_services WHERE store_ID = s.id) AS totalservices,
          (SELECT COUNT(*) FROM tbl_customer WHERE (store_ID = s.id OR reffstore = s.id) AND delet_flage != '1') AS totalcustomer
        FROM tbl_store s
        LEFT JOIN tbl_order o ON s.id = o.store_id
        WHERE s.status = 1 AND s.delete_flage = 0
        GROUP BY s.id, s.name
        ORDER BY s.id ASC
      `);
    }

    return res.json({
      success: true,
      isStoreScoped,
      isStaff,
      targetStore: targetStore || "all",
      data: {
        tottalsales: Number(stats.tottalsales || 0),
        totalorder: Number(stats.totalorder || 0),
        totalservices: Number(stats.totalservices || 0),
        totalcustomer: Number(stats.totalcustomer || 0),
      },
      storeStatsList,
    });
  } catch (err) {
    console.error("Error in /api/dashboard-stats:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

async function groupOrdersByYearAndMonth(orders) {
  const groupedOrders = [];
  let totorder = "",
    totsales = "";

  orders.forEach((order) => {
    const orderDate = new Date(order.order_date);
    const year = orderDate.getFullYear();
    const month = orderDate.getMonth() + 1;

    let yearGroup = groupedOrders.find((item) => item.year === year);
    if (!yearGroup) {
      yearGroup = { year: year, months: [] };
      groupedOrders.push(yearGroup);
    }

    let monthGroup = yearGroup.months.find((item) => item.month === month);
    if (!monthGroup) {
      monthGroup = { month: month, orders: [] };
      yearGroup.months.push(monthGroup);
    }

    monthGroup.orders.push(order);
  });

  groupedOrders.forEach((yearGroup) => {
    let totmonth = "",
      totmonsales = "";
    yearGroup.months.forEach((monthGroup, index) => {
      let tm = monthGroup.month,
        to = monthGroup.orders.length,
        gtotal = 0;
      monthGroup.totalOrders = to;

      totmonth += totmonth == "" ? `${tm}#${to}` : `@${tm}#${to}`;

      monthGroup.orders.forEach((gross) => {
        gtotal += parseFloat(gross.gross_total);
      });
      totmonsales +=
        totmonsales == ""
          ? `${tm}#${gtotal.toFixed(0)}`
          : `@${tm}#${gtotal.toFixed(0)}`;

      delete monthGroup.orders;
    });

    totorder +=
      totorder == ""
        ? yearGroup.year + "&!" + totmonth
        : "&&!" + yearGroup.year + "&!" + totmonth;
    totsales +=
      totsales == ""
        ? yearGroup.year + "&!" + totmonsales
        : "&&!" + yearGroup.year + "&!" + totmonsales;
  });

  return { totorder, totsales };
}

router.get("/profile", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    res.render("profile", {
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/updatecustompro", auth, upload.single("image"), async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { id, roll, store, loginas } = req.user;
    const { name, number, email, username, password } = req.body;

    const check_number = await DataFind(
      "SELECT * FROM tbl_customer WHERE number='" +
        number +
        "' AND id !=" +
        id +
        "",
    );
    if (check_number.length > 0) {
      req.flash("error", "This Mobile Number Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const check_username = await DataFind(
      "SELECT * FROM tbl_customer WHERE username='" +
        username +
        "' AND id !=" +
        id +
        "",
    );
    if (check_username.length > 0) {
      req.flash("error", "This UserName Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    let OldData = await DataFind(`SELECT * FROM tbl_customer WHERE id=${id}`);
    let haspass = "";

    if (password && password.length > 0) {
      const salt = bcrypt.genSaltSync(10);
      haspass = bcrypt.hashSync(password, salt);
    } else {
      haspass = (OldData && OldData[0]) ? OldData[0].password : "";
    }

    let imgClause = "";
    if (req.file && req.file.filename) {
      imgClause = `,img='${req.file.filename}'`;
    }

    const data = await DataUpdate(
      `tbl_customer`,
      `name='${name}',number='${number}',email='${email}',username='${username}',password='${haspass}'${imgClause}`,
      `id=${id}`,
      req.hostname,
      req.protocol,
    );

    if (data == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "Profile Details Updated Successfully!");
    res.redirect("back");
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while updating profile");
    res.redirect("back");
  }
});

router.post("/updatestaff", auth, upload.single("image"), async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const { id, roll, store, loginas } = req.user;
    const { name, number, email, username, password } = req.body;

    const checkname = await DataFind(
      "SELECT * FROM tbl_admin WHERE username='" +
        username +
        "' AND id !=" +
        id +
        "",
    );

    if (checkname.length > 0) {
      req.flash("error", "This User Name Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const checknumber = await DataFind(
      "SELECT * FROM tbl_admin WHERE number='" +
        number +
        "' AND id !=" +
        id +
        "",
    );

    if (checknumber.length > 0) {
      req.flash("error", "This Number Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    const checkstore_email = await DataFind(
      "SELECT * FROM tbl_admin WHERE email='" + email + "' AND id !=" + id + "",
    );

    if (checkstore_email.length > 0) {
      req.flash("error", "This Email Alredy Register!!!!");
      return res.redirect(req.get("Referrer") || "/");
    }

    let OldData = await DataFind(`SELECT * FROM tbl_admin WHERE id='${id}'`);
    let hashpass = "";

    if (password && password.length > 0) {
      const salt = bcrypt.genSaltSync(10);
      hashpass = bcrypt.hashSync(password, salt);
    } else {
      hashpass = (OldData && OldData[0]) ? OldData[0].password : "";
    }

    let imgClause = "";
    if (req.file && req.file.filename) {
      imgClause = `,img='${req.file.filename}'`;
    }

    const data = await DataUpdate(
      `tbl_admin`,
      `name='${name}',number='${number}',email='${email}',username='${username}',password='${hashpass}'${imgClause}`,
      `id=${id}`,
      req.hostname,
      req.protocol,
    );

    if (data == -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "Profile Details Updated Successfully!");
    return res.redirect(req.get("Referrer") || "/");
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while updating profile");
    return res.redirect(req.get("Referrer") || "/");
  }
});

//logout get router
router.get("/logout", auth, async (req, res) => {
  res.clearCookie("webtoken");
  res.clearCookie("lang");

  res.redirect("/");
});

// =========== lang ============= //

router.get("/lang/:id", async (req, res) => {
  try {
    const { getMultiLanguageEnabled } = require("../middelwer/language");
    const isMultiLang = await getMultiLanguageEnabled();
    if (!isMultiLang) {
      res.clearCookie("lang");
      return res.status(200).json({ token: null, lang: "en", disabled: true });
    }

    const token = jwt.sign({ lang: req.params.id }, process.env.TOKEN);
    res.cookie("lang", token, { path: "/", maxAge: 365 * 24 * 60 * 60 * 1000 });

    return res.status(200).json({ token, lang: req.params.id });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: "Failed to set language" });
  }
});

module.exports = router;
