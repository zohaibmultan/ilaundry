const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
const bcrypt = require('bcrypt')
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey")

router.get("/list", auth, async (req, res) => {
  const { id, roll, store, loginas } = req.user;
  const accessdata = await access(req.user);

  const storeList = await DataFind(
    "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
  );
  const multiy = await DataFind(
    "SELECT type , customer_selection FROM tbl_master_shop"
  );
  if (multiy[0].type == 1 && multiy[0].customer_selection == 0) {
    var ismulty = true;
  } else {
    var ismulty = false;
  }

  if (loginas == 0) {
    var ismulty = false;
    var qury = `  SELECT 
    c.*, 
    (
      SELECT COUNT(*) 
      FROM tbl_transections t
      JOIN tbl_account a ON t.account_id = a.id
      WHERE t.customer_id = c.id
    ) AS transiction
  FROM tbl_customer c
  WHERE c.store_ID = "${store}" 
    AND c.username != '' 
    AND c.delet_flage = 0 
    AND c.id = ${id}`;

    var login = "customer";
  } else {
    const rolldetail = await DataFind(`
                                SELECT 
                                sr.*,
                                r.roll_status, 
                                r.rollType 
                                FROM tbl_staff_roll sr
                                JOIN tbl_roll r ON sr.main_roll_id = r.id
                                WHERE sr.id = ${roll}
                                     `);
    console.log("rolldetail", rolldetail);

    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].customers.includes("read")
    ) {
      var login = "master";

      var qury = `SELECT tbl_customer.*,  COALESCE(tbl_store.name, '') AS store,  (
        SELECT COUNT(*) 
        FROM tbl_transections 
        JOIN tbl_account ON tbl_transections.account_id = tbl_account.id
        WHERE tbl_transections.customer_id = tbl_customer.id
     
      ) AS transiction FROM  tbl_customer LEFT JOIN  tbl_store ON   tbl_customer.store_ID = tbl_store.id WHERE  tbl_customer.  delet_flage = 0   AND (tbl_customer.username != ''  OR tbl_customer.number != '' OR tbl_customer.email != '')`;
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].customers.includes("read")
    ) {
      var login = "store";

      if (multiy[0].customer_selection == 1) {
        var qury = `SELECT tbl_customer.*, (
        SELECT COUNT(*) 
        FROM tbl_transections 
        JOIN tbl_account ON tbl_transections.account_id = tbl_account.id
        WHERE tbl_transections.customer_id = tbl_customer.id
 
      ) AS transiction  FROM tbl_customer WHERE (username != ''  AND number != ''  AND  email != '') AND delet_flage = 0 `;
      } else {
        var qury = `SELECT tbl_customer.*, (
        SELECT COUNT(*) 
        FROM tbl_transections 
        JOIN tbl_account ON tbl_transections.account_id = tbl_account.id
        WHERE tbl_transections.customer_id = tbl_customer.id
          
      ) AS transiction FROM tbl_customer where store_ID="${store}" AND (username != ''  AND number != '' AND  email != '' ) AND delet_flage = 0 `;
      }
    } else {
      req.flash("error", "Your are not authoraized");
      return res.redirect("back");
    }
  }

  let alldata = await DataFind(qury);
  let newdata = alldata.map(async (dval) => {
    
    let ledger = await DataFind(
      `SELECT COUNT(*) AS tot_ledger FROM tbl_transections WHERE store_ID = '${dval.store_ID}'`
    );
    dval.tot_ledger = ledger[0].tot_ledger;
    return dval;
  });
  let data = await Promise.all(newdata);
   console.log("data12",data);
   
  res.render("coustomer", {
    coustormdata: data,
    login,
    ismulty,
    storeList,
    accessdata,
    language: req.language_data,
    language_name: req.language_name,
  });
});


router.post("/update/:id", async (req, res) => {
  try {
    const id = req.params.id;

    const { name, number, email, tax, address } = req.body;
    // var active;
    // req.body.active == 0 ? (active = 0) : (active = 1);

    var approved;
    req.body.approved == 1 ? (approved = 1) : (approved = 0);

    

const data = await DataUpdate(
        `tbl_customer`,
        `name='${name}',
         number='${number}',
         email='${email}',
         address='${address}',
         taxnumber='${tax}',
         approved='${approved}'`,
        `id=${id}`,
        req.hostname,req.protocol);


      if (data == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

    req.flash("success", "Your Data is UPDATE Success Fully");
    res.redirect("/coustomer/list");
  } catch (error) {
    console.log(error);
  }
});

router.post("/register", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    } else {
      const { name, number, email, taxnumber, address, username, password } =
        req.body;
      var storeid = req.body.storeid;
      var verfiyStore = await DataFind(`SELECT * FROM tbl_admin WHERE id=${id}`)
      storeid ? storeid : (storeid = verfiyStore[0].store_ID);
          
      const check_number = await DataFind(
        "SELECT * FROM tbl_customer WHERE number='" + number + "'"
      );
      if (check_number.length > 0) {
        req.flash("error", "This Mobile Number Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }else{
        let check_usernameinadmin = await DataFind(
        "SELECT * FROM tbl_admin WHERE number='" + number + "'"
      );

      if (check_usernameinadmin.length > 0  && check_usernameinadmin[0].username != '') {
        req.flash("error", "This Mobile Number Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
    }

      const check_username = await DataFind(
        "SELECT * FROM tbl_customer WHERE username='" + username + "'"
      );
      if (check_username.length > 0  && check_username[0].username != '') {
        req.flash("error", "This UserName Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }else{
        let check_usernameinadmin = await DataFind(
        "SELECT * FROM tbl_admin WHERE username='" + username + "'"
      );

      if (check_usernameinadmin.length > 0  && check_usernameinadmin[0].username != '') {
        req.flash("error", "This UserName Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
      }

    const check_email = await DataFind(
        "SELECT * FROM tbl_customer WHERE email='" + email + "'"
      );

      if (check_email.length > 0) {
        req.flash("error", "This Email Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }else{
        let check_usernameinadmin = await DataFind(
        "SELECT * FROM tbl_admin WHERE email='" + email + "'"
      );

      if (check_usernameinadmin.length > 0  && check_usernameinadmin[0].username != '') {
        req.flash("error", "This Email Alredy Register!!!!");
        return res.redirect(req.get("Referrer") || "/");
      }
    }
      let main_roll = await DataFind(
        "SELECT * FROM tbl_roll WHERE rollType='customer'"
      );
      let hashpass = ''
      if(password.length>0 || password != ''){
      const salt = bcrypt.genSaltSync(10);
       hashpass = bcrypt.hashSync(password,salt)
      console.log("hashpass",hashpass);
      }
      // var qury =
      //   "INSERT INTO tbl_customer (name,number,email,address,taxnumber,username,password,store_ID,main_roll_id,approved) VALUE ('" +
      //   name +
      //   "','" +
      //   number +
      //   "','" +
      //   email +
      //   "','" +
      //   address +
      //   "','" +
      //   taxnumber +
      //   "','" +
      //   username +
      //   "','" +
      //   hashpass +
      //   "','" +
      //   storeid +
      //   "'," +
      //   main_roll[0].id +
      //   ", 1 )";

      // const data = await DataFind(qury);
      const data = await DataInsert(
  `tbl_customer`,
  `name,number,email,address,taxnumber,username,password,store_ID,main_roll_id,approved`,
  `'${name}','${number}','${email}','${address}','${taxnumber}','${username}','${hashpass}','${storeid}',${main_roll[0].id},1`,
  req.hostname,
  req.protocol
);

if (data == -1) {
  req.flash('error', process.env.dataerror);
  return res.redirect("/validate");
}

      req.flash(
        "success",
        "Your data has been sent to the administration for approval!"
      );
      res.redirect("back");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/ledger/:id", auth, async (req, res) => {
  try {
    const accessdata = await access(req.user);

    console.log(req.params.id);

    var qury = `SELECT tbl_transections.*, COALESCE(tbl_account.ac_name, "") AS ac_name
                FROM tbl_customer 
                JOIN tbl_transections ON tbl_customer.id = tbl_transections.customer_id
                JOIN tbl_account ON tbl_transections.account_id=tbl_account.id
                WHERE tbl_customer.id = '${req.params.id}'`;

    const transection_list = await DataFind(qury);

    const customerData = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
    const customer = (customerData && customerData.length > 0) ? customerData[0] : null;

    res.render("customer_ledger", {
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
      transection_list,
      customer,
    });
  } catch (error) {
    console.log(error);
  }
});    


router.get("/delete/:id", auth, async (req, res) => {
    if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
  // var qury = `UPDATE  tbl_customer SET delet_flage = '1'  WHERE id = '${req.params.id}'`;

  // const transection_list = await DataFind(qury);


const transection_list = await DataUpdate(
        `tbl_customer`,
        `delet_flage = '1'`,
        `id=${req.params.id}`,
        req.hostname,req.protocol);


      if (transection_list == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

  req.flash("success", "Customer Deleted Successfully");
  res.redirect("/coustomer/list");
});

module.exports = router;
