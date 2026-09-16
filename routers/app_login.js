const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const bcrypt = require("bcrypt");
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey")


router.post("/login", async (req, res) => {
  try {
    const { username, password, loginas } = req.body;
    if (loginas == 0) {
      var qury =
        "SELECT * FROM tbl_customer WHERE username='" +
        username +
        "' AND delet_flage=0 AND approved=1";
    } else {
      var qury =
        "SELECT * FROM tbl_admin WHERE username='" +
        username +
        "' AND delet_flage=0 AND approved=1";
    }

    const data = await DataFind(qury);

    if (data.length == 0) {
      return res.status(200).json({
        status: "error",
        ResponseCode: "400",
        message: "Invalid Username.",
      });
    }

    if (data[0].password !== password) {
      return res.status(200).json({
        status: "error",
        ResponseCode: "400",
        message: "Invalid password.",
      });
    }

    if (loginas == 0) {
      var token = await jwt.sign(
        { id: data[0].id, roll: 0, store: data[0].store_ID, loginas },
        process.env.TOKEN_KEY
      );
    } else {
      var token = await jwt.sign(
        {
          id: data[0].id,
          roll: data[0].roll_id,
          store: data[0].store_ID,
          loginas,
        },
        process.env.TOKEN_KEY
      );
    }

    const {
      password: pass,
      roll_id,
      approved,
      delet_flage,
      ...userdata
    } = data[0];

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      message: "Login successful",
      userdata: userdata,
      token: token,
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      number,
      email,
      taxnumber,
      address,
      username,
      password,
      store,
    } = req.body;
    const check_number = await DataFind(
      "SELECT * FROM tbl_customer WHERE number='" + number + "'"
    );
    if (check_number.length > 0) {
      return res.status(200).json({
        status: "error",
        ResponseCode: "400",
        message: "This Mobile Number Alredy Register!!!!",
      });
    }

    const check_username = await DataFind(
      "SELECT * FROM tbl_customer WHERE username='" + username + "'"
    );
    if (check_username.length > 0) {
      return res.status(200).json({
        status: "error",
        ResponseCode: "400",
        message: "This UserName Alredy Register!!!!",
      });
    }

    if (store) {
     
      if (
        (await DataInsert(
          `tbl_customer`,
          `name,number,email,address,taxnumber,username,password,store_ID`,
          `'${name}','${number}','${email}','${address}','${taxnumber}','${username}','${password}','${store}'`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }
    } else {
      // var qury = "INSERT INTO tbl_customer (name,number,email,address,taxnumber,username,password) VALUE ('"+name+"','"+number+"','"+email+"','"+address+"','"+taxnumber+"','"+username+"','"+password+"')"
      if (
        (await DataInsert(
          `tbl_customer`,
          `name,number,email,address,taxnumber,username,password`,
          `'${name}','${number}','${email}','${address}','${taxnumber}','${username}','${password}'`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }
    }
    // const data = await DataFind(qury);
    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      message:"Registration was successful, and data was sent to the administrator for approval.",
    });
  }catch (error) {
    console.log(error);
  }
});

router.get("/multy", async (req, res) => {
  try {
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    if (multiy[0].type == 1) {
      var storeList = await DataFind(
        "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
      );
      console.log(storeList);
      res.status(200).json({
        status: "success",
        ResponseCode: "200",
        multiy: true,
        storelist: storeList,
        message: "Store is Multi mode",
      });
    } else {
      res.status(200).json({
        status: "success",
        ResponseCode: "200",
        multiy: false,
        storelist: [],
        message: "store is single mode",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.get("/store", async (req, res) => {
  try {
    const store_list = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status = 1"
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      store_list: store_list,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.post("/customer", async (req, res) => {
  try {
    const { store_id } = req.body;
    console.log(store_id);
    const customer_list = await DataFind(
      "SELECT id,name FROM tbl_customer WHERE store_id = " + store_id + ""
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      customer_list: customer_list,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.post("/services", async (req, res) => {
  try {
    const { store_id } = req.body;

    const services = await DataFind(
      "SELECT * FROM tbl_services WHERE store_id = " + store_id + ""
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      services: services,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.post("/services_type", async (req, res) => {
  try {
    const { services_type_id } = req.body;
    const type_id = req.body;

    const services_type = await DataFind(
      "SELECT * FROM tbl_services_type WHERE id IN (" +
        type_id.services_type_id +
        ") "
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      services_type: services_type,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.post("/addons", async (req, res) => {
  try {
    const { store_id } = req.body;

    const services = await DataFind(
      "SELECT * FROM tbl_addons WHERE store_id = " + store_id + ""
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      services: services,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

router.post("/coupon", async (req, res) => {
  try {
    const { store_id } = req.body;

    const services = await DataFind(
      "select * from tbl_coupon where start_date <=date(now()) AND end_date >=date(now()) AND status=0 AND find_in_set('" +
        store_id +
        "',store_list_id)"
    );

    res.status(200).json({
      status: "success",
      ResponseCode: "200",
      services: services,
    });
  } catch (error) {
    console.log(error);
    return res.status(200).json({
      status: "error",
      ResponseCode: "400",
      message: error.message,
    });
  }
});

module.exports = router;
