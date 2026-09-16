const express = require("express");
  const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
var Excel = require("exceljs");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind
} = require("../middelwer/databaseQurey");
// <<<<<<< account List >>>>>>>>>>>>>
router.get("/list", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    console.log("accessdata", accessdata);

    if (accessdata.mutibranch !== false && rolldetail[0].rollType == "master") {
      var comi = await DataFind(
        `SELECT SUM(master_comission) as amount FROM tbl_order WHERE commission_status ='1'`
      );
      var paidcomi = await DataFind(
        `SELECT SUM(amount) as amount FROM tbl_commision`
      );
      var comission;
      var paidcomission;

      comi.length > 0
        ? (comission = Number(comi[0].amount).toFixed(2))
        : (comission = 0);
      paidcomi.length > 0
        ? (paidcomission = Number(paidcomi[0].amount).toFixed(2))
        : (paidcomission = 0);
      var due = parseFloat(comission) - parseFloat(paidcomission);
      var qury = `SELECT tbl_account.*, sum('credit_amount') as credit, sum('debit_amount') as debit FROM tbl_account JOIN tbl_transections on tbl_account.id=tbl_transections.account_id WHERE tbl_account.store_ID= "" AND delet_flage=0 GROUP BY tbl_account.id`;
      const storeList = await DataFind(qury);
      res.render("account_list", {
        account_list: storeList,
        accessdata,
        comission,
        paidcomission,
        due,
        toaccount: [],
        fromaccount: [],
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].account.includes("read")
    ) {
      var findID = await DataFind(`SELECT * FROM tbl_admin WHERE id='${id}'`);
      var comi = await DataFind(
        "SELECT SUM(master_comission) as amount FROM tbl_order WHERE store_id=" +
          findID[0].store_ID +
          " AND commission_status='1' "
      );
      var paidcomi = await DataFind(
        "SELECT SUM(amount) as amount FROM tbl_commision WHERE store_id=" +
          findID[0].store_ID +
          ""
      );
      console.log("findID", findID);
      console.log("comi", comi);
      console.log("paidcomi", paidcomi);

      var comission;
      var paidcomission;

      comi.length > 0
        ? (comission = Number(comi[0].amount).toFixed(2))
        : (comission = 0);
      paidcomi.length > 0
        ? (paidcomission = Number(paidcomi[0].amount).toFixed(2))
        : (paidcomission = 0);
      var due = parseFloat(comission) - parseFloat(paidcomission);

      var toaccount = await DataFind(
        "SELECT * FROM tbl_account WHERE store_ID=''"
      );
      console.log("toaccount", toaccount);

      var fromaccount = await DataFind(
        "SELECT * FROM tbl_account WHERE store_ID=" + findID[0].store_ID + ""
      );
      console.log("fromaccount", fromaccount);

      var qury =
        "SELECT tbl_account.*, sum(`credit_amount`) as credit, sum(`debit_amount`) as debit FROM tbl_account JOIN tbl_transections on tbl_account.id=tbl_transections.account_id WHERE tbl_account.store_ID= " +
        findID[0].store_ID +
        " AND delet_flage=0 GROUP BY tbl_account.id";

      const account_list = await DataFind(qury);
      console.log("account_list", account_list);

      res.render("account_list", {
        account_list,
        accessdata,
        comission,
        paidcomission,
        due,
        toaccount,
        fromaccount,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      accessdata.mutibranch == false &&
      rolldetail[0].rollType == "master"
    ) {
      const accessdata = await access(req.user);

      var findRoll = await DataFind(`SELECT ad.* FROM tbl_staff_roll sr 
                                          JOIN tbl_roll r ON sr.main_roll_id = r.id
                                          JOIN tbl_admin ad ON sr.staff_id = ad.id
                                          WHERE r.rollType ='master' AND sr.is_staff='0'`);
      var findID = await DataFind(
        `SELECT ad.*, '${findRoll[0].store_ID}' as store_ID FROM tbl_admin ad WHERE id='${id}'`
      );
      //  var findID = await DataFind(`SELECT * FROM tbl_admin WHERE id='${id}'`);
      var comi = await DataFind(
        "SELECT SUM(master_comission) as amount FROM tbl_order WHERE store_id=" +
          findID[0].store_ID +
          " AND commission_status='1' "
      );
      var paidcomi = await DataFind(
        "SELECT SUM(amount) as amount FROM tbl_commision WHERE store_id=" +
          findID[0].store_ID +
          ""
      );
      console.log("findID", findID);
      console.log("comi", comi);
      console.log("paidcomi", paidcomi);

      var comission;
      var paidcomission;

      comi.length > 0
        ? (comission = Number(comi[0].amount).toFixed(2))
        : (comission = 0);
      paidcomi.length > 0
        ? (paidcomission = Number(paidcomi[0].amount).toFixed(2))
        : (paidcomission = 0);
      var due = parseFloat(comission) - parseFloat(paidcomission);

      var toaccount = await DataFind(
        "SELECT * FROM tbl_account WHERE store_ID=''"
      );
      console.log("toaccount", toaccount);

      var fromaccount = await DataFind(
        "SELECT * FROM tbl_account WHERE store_ID=" + findID[0].store_ID + ""
      );
      console.log("fromaccount", fromaccount);

      var qury =
        "SELECT tbl_account.*, sum(`credit_amount`) as credit, sum(`debit_amount`) as debit FROM tbl_account JOIN tbl_transections on tbl_account.id=tbl_transections.account_id WHERE tbl_account.store_ID= " +
        findID[0].store_ID +
        " AND delet_flage=0 GROUP BY tbl_account.id";

      const account_list = await DataFind(qury);
      console.log("account_list", account_list);

      res.render("account_list", {
        account_list,
        accessdata,
        comission,
        paidcomission,
        due,
        toaccount,
        fromaccount,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/addaccount", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    const accessdata = await access(req.user);

    let findStore = await DataFind(`SELECT * FROM tbl_admin WHERE id='${id}'`);

    if (
      accessdata.rollType === "master" ||
      rolldetail[0].account.includes("write")
    ) {
      const { ac_name, ac_number, balance, description } = req.body;
      

      const newaccount = await DataInsert(
        `tbl_account`,
        `ac_name,ac_number,ac_decrip,store_ID,balance,store_name`,
        `'${ac_name}','${ac_number}',
                   '${description}','${""}','${balance}','${"master"}'`,
        req.hostname,
        req.protocol
      );

      if (newaccount == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

     
      if (
        (await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,credit_amount,balance_amount`,
          `'${
            newaccount.insertId
          }','${""}','New Account Opening','INCOME',${balance},${balance}`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      req.flash("success", "New Account Added !!!!");
      res.redirect("back");
    } else if (
      accessdata.rollType === "store" ||
      rolldetail[0].account.includes("write")
    ) {
      const { ac_name, ac_number, balance, description } = req.body;

      const storename = await DataFind(
        "SELECT name FROM tbl_store WHERE id=" + findStore[0].store_ID + " "
      );

      

      const newaccount = await DataInsert(
        `tbl_account`,
        `ac_name,ac_number,ac_decrip,store_ID,balance,store_name`,
        `'${ac_name}','${ac_number}','${description}','${findStore[0].store_ID}','${balance}','${storename[0].name}'`,
        req.hostname,
        req.protocol
      );

      if (newaccount == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      
      if (
        (await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,credit_amount,balance_amount`,
          `${newaccount.insertId},${findStore[0].store_ID},'New Account Opening','INCOME',${balance},${balance}`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      req.flash("success", "New Account Added !!!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updateaccount/:id", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    const accessdata = await access(req.user);
    if (
      accessdata.mutibranch === false ||
      rolldetail[0].account.includes("edit")
    ) {
      const { ac_name, ac_number, ac_decrip } = req.body;
      var dataid = req.params.id;
     

      const rollList = await DataUpdate(
        `tbl_account`,
        `ac_name='${ac_name}',ac_number='${ac_number}',ac_decrip='${ac_decrip}'`,
        `id=${dataid}`,
        req.hostname,
        req.protocol
      );
      if (rollList == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      req.flash("success", "Account Update success Fully !!!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/deletaccount/:id", auth, async (req, res) => {
  try {
      if (process.env.DISABLE_DB_WRITE === 'true') {
    req.flash('error', 'For demo purpose we disabled crud operations!!');
    return res.redirect(req.get("Referrer") || "/");
}
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    const accessdata = await access(req.user);
    if (
      accessdata.mutibranch === false ||
      rolldetail[0].account.includes("delete")
    ) {
      var dataid = req.params.id;
      

      const rollList = await DataUpdate(
        `tbl_account`,
        `delet_flage=1`,
        `id=${dataid}`,
        req.hostname,
        req.protocol
      );
      if (rollList == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      req.flash("success", "Account Delete success Fully !!!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

// <<<<<<< Transection List >>>>>>>>>>>>>
router.get("/transection", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    const accessdata = await access(req.user);
    console.log("accessdata", accessdata);

    if (
      accessdata.mutibranch == false ||
      rolldetail[0].account.includes("read")
    ) {
      const accessdata = await access(req.user);

      let qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections 
                  JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
                  WHERE tbl_transections.store_ID='${store}' ORDER BY tbl_transections.id DESC  `;
      let account_list = [];

      if (accessdata.mutibranch == false) {
        account_list = await DataFind(
          "SELECT id,ac_name FROM tbl_account WHERE store_ID='" +
            accessdata.topbardata.store_ID +
            "' AND delet_flage=0 "
        );

        qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections 
                  JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
                  WHERE tbl_transections.store_ID='${accessdata.topbardata.store_ID}' ORDER BY tbl_transections.id DESC  `;
      } else {
        account_list = await DataFind(
          "SELECT id,ac_name FROM tbl_account WHERE store_ID='" +
            store +
            "' AND delet_flage=0 "
        );
        qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections 
                  JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
                  WHERE tbl_transections.store_ID='${store}' ORDER BY tbl_transections.id DESC  `;
      }

      const transection_list = await DataFind(qury);

      res.render("account_transection", {
        transection_list,
        account_list,
        account: 0,
        start_date: "",
        end_date: "",
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/transefilter", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    if (
      accessdata.mutibranch === false ||
      rolldetail[0].account.includes("read")
    ) {
      const { account, start_date, end_date } = req.body;

     

      var qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
            WHERE (tbl_transections.account_id='${account}') AND (DATE(tbl_transections.date) BETWEEN '${start_date}' AND '${end_date}') `;
      const transection_list = await DataFind(qury);
      console.log(transection_list);

      const account_list = await DataFind(
        "SELECT id,ac_name FROM tbl_account WHERE store_ID=" +
          store +
          " AND delet_flage=0 "
      );

      res.render("account_transection", {
        transection_list,
        account_list,
        account,
        start_date,
        end_date,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/download/:id", auth, async (req, res) => {
  try {
    const account = req.params.id.split("+")[0];
    const start_date = req.params.id.split("+")[1];
    const end_date = req.params.id.split("+")[2];

    if (!account && !start_date && !end_date) {
      req.flash("error", "Please Select Detail");
      return res.redirect(req.get("Referrer") || "/");
    }

    var qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
                    WHERE (tbl_transections.account_id='${account}') AND (DATE(tbl_transections.date) BETWEEN '${start_date}' AND '${end_date}') `;
    let transection_list = await DataFind(qury);

    transection_list.map((tval) => {
      let Order_date = new Date(tval.date);
      let Order_day =
        (Order_date.getDate() < 10 ? "0" : "") + Order_date.getDate();
      let Order_month =
        (Order_date.getMonth() + 1 < 10 ? "0" : "") +
        (Order_date.getMonth() + 1);
      let Order_year = Order_date.getFullYear();
      let Order_fullDate = `${Order_year}-${Order_month}-${Order_day}`;
      tval.date = Order_fullDate;
    });

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Date", key: "date", width: 35 },
      { header: "Account", key: "ac_name", width: 35 },
      { header: "Type", key: "transec_type", width: 40 },
      { header: "Description", key: "transec_detail", width: 35 },
      { header: "Debit", key: "debit_amount", width: 30 },
      { header: "Credit", key: "credit_amount", width: 30 },
      { header: "Balance", key: "balance_amount", width: 30 },
    ];
    transection_list.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "Transactionreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });

    // res.redirect("/account/transection")
  } catch (error) {
    console.log(error);
  }
});

//<<<<<<< payout >>>>>>>
router.get("/payout", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    if (multiy[0].type == 0) {
      req.flash("error", "This Page Not Faund");
      return res.redirect(req.get("Referrer") || "/");
    }
    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].Pay_Out.includes("read")
    ) {
      var comi = await DataFind(
        "SELECT SUM(master_comission) as amount FROM tbl_order WHERE commission_status = '1' "
      );
      var paidcomi = await DataFind(
        "SELECT SUM(amount) as amount FROM tbl_commision"
      );
      var comission;
      var paidcomission;

      comi.length > 0
        ? (comission = Number(comi[0].amount).toFixed(2))
        : (comission = 0);
      paidcomi.length > 0
        ? (paidcomission = Number(paidcomi[0].amount).toFixed(2))
        : (paidcomission = 0);
      var due = parseFloat(comission) - parseFloat(paidcomission);

      var qury = `SELECT id,name,IFNULL((SELECT SUM(master_comission) FROM tbl_order WHERE store_id=tbl_store.id AND commission_status='1' ),0) as comiision,
                     IFNULL((SELECT SUM(amount) FROM tbl_commision WHERE store_id=tbl_store.id),0) as pay  FROM tbl_store WHERE status=1  `;
      const storeList = await DataFind(qury);
      console.log(storeList);
      res.render("payout", {
        storeList,
        accessdata,
        comission,
        paidcomission,
        due,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/payoutdetails/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    if (multiy[0].type == 0) {
      req.flash("error", "This Page Not Faund");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].Pay_Out.includes("read")
    ) {
      var storeid = req.params.id;
      var storname = await DataFind(
        "SELECT name FROM tbl_store WHERE id =" + storeid + ""
      );

      var qury =
        "SELECT tbl_account.*, sum(`credit_amount`) as credit, sum(`debit_amount`) as debit FROM tbl_account JOIN tbl_transections on tbl_account.id=tbl_transections.account_id WHERE tbl_account.store_ID= " +
        storeid +
        " AND delet_flage=0 GROUP BY tbl_account.id ";
      const account_list = await DataFind(qury);

      res.render("payout_account_details", {
        account_list,
        storeid,
        storname: storname[0].name,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/payoutransections/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");

    if (multiy[0].type == 0) {
      req.flash("error", "This Page Not Faund");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);

    if (rolldetail[0].Pay_Out.includes("read")) {
      var storeid = req.params.id;
      var qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
            WHERE tbl_transections.store_ID=${storeid}  `;
      const transection_list = await DataFind(qury);
      const account_list = await DataFind(
        "SELECT id,ac_name FROM tbl_account WHERE store_ID=" +
          storeid +
          " AND delet_flage=0 "
      );
      var storname = await DataFind(
        "SELECT name FROM tbl_store WHERE id =" + storeid + ""
      );

      res.render("payout_transection_list", {
        transection_list,
        account_list,
        storeid,
        account: 0,
        start_date: "",
        end_date: "",
        storname: storname[0].name,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/payouttransefilter", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const { account, start_date, end_date, store_id } = req.body;
    console.log("account", account);
    console.log("start_date", start_date);
    console.log("end_date", end_date);
   

    var qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
        WHERE (tbl_transections.account_id = '${account}') AND (DATE(tbl_transections.date) BETWEEN '${start_date}' AND '${end_date}') `;
    const transection_list = await DataFind(qury);
    console.log(transection_list);

    var storname = await DataFind(
      "SELECT name FROM tbl_store WHERE id =" + store_id + ""
    );

    const account_list = await DataFind(
      "SELECT id,ac_name FROM tbl_account WHERE store_ID=" +
        store_id +
        " AND delet_flage=0 "
    );
    res.render("payout_transection_list", {
      transection_list,
      account_list,
      storeid: store_id,
      account,
      start_date,
      end_date,
      storname: storname[0].name,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/cashdownload/:id", auth, async (req, res) => {
  try {
    const account = req.params.id.split("+")[0];
    const start_date = req.params.id.split("+")[1];
    const end_date = req.params.id.split("+")[2];

    var qury = `SELECT tbl_transections.*, tbl_account.ac_name FROM tbl_transections JOIN tbl_account ON tbl_transections.account_id=tbl_account.id 
        WHERE (tbl_transections.account_id = '${account}') AND (DATE(tbl_transections.date) BETWEEN '${start_date}' AND '${end_date}') `;
    const transection_list = await DataFind(qury);

    transection_list.map((tval) => {
      let Order_date = new Date(tval.date);
      let Order_day =
        (Order_date.getDate() < 10 ? "0" : "") + Order_date.getDate();
      let Order_month =
        (Order_date.getMonth() + 1 < 10 ? "0" : "") +
        (Order_date.getMonth() + 1);
      let Order_year = Order_date.getFullYear();
      let Order_fullDate = `${Order_year}-${Order_month}-${Order_day}`;
      tval.date = Order_fullDate;
    });

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Date", key: "date", width: 35 },
      { header: "Account", key: "ac_name", width: 35 },
      { header: "Type", key: "transec_type", width: 40 },
      { header: "Description", key: "transec_detail", width: 35 },
      { header: "Debit", key: "debit_amount", width: 30 },
      { header: "Credit", key: "credit_amount", width: 30 },
      { header: "Balance", key: "balance_amount", width: 30 },
    ];
    transection_list.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "Cashreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/comission", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
  SELECT 
    sr.*, 
    r.roll_status, 
    r.rollType 
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
    const accessdata = await access(req.user);
    if (
      accessdata.mutibranch === false ||
      rolldetail[0].account.includes("write")
    ) {
      const {
        due_amount,
        pay_amount,
        to_account,
        from_account,
        date,
        description,
      } = req.body;

     
      if (
        (await DataInsert(
          `tbl_commision`,
          `date,amount,from_account,to_account,description,store_id`,
          `'${date}','${pay_amount}','${from_account}','${to_account}','${description}','${store}'`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      // <<<< to Account update >>>>>>>>>>
      const toaccoumt = await DataFind(
        "SELECT * FROM tbl_account WHERE id=" + to_account + ""
      );
      const tobalance =
        parseFloat(toaccoumt[0].balance) + parseFloat(pay_amount);
     

      const data = await DataUpdate(
        `tbl_account`,
        `balance='${tobalance}'`,
        `id=${to_account}`,
        req.hostname,
        req.protocol
      );
      if (data == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

    
      if (
        (await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,debit_amount,
                        credit_amount,balance_amount,date, customer_id`,
          `'${to_account}','1','Store Comission','INCOME',0,${pay_amount},${tobalance},'${date}', '0'`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      //  <<<<<<  FROM Account update >>>>>>>>>>
      const fromaccoumt = await DataFind(
        "SELECT * FROM tbl_account WHERE id=" + from_account + ""
      );
      const frombalance =
        parseFloat(fromaccoumt[0].balance) - parseFloat(pay_amount);

    

       const data2 = await DataUpdate(
        `tbl_account`,
        `balance='${frombalance}'`,
        `id=${from_account}`,
        req.hostname,
        req.protocol
      );
      if (data2 == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      
      if (
        (await DataInsert(
          `tbl_transections`,
          `account_id,store_ID,transec_detail,transec_type,debit_amount,
                        credit_amount,balance_amount,date, customer_id`,
          `'${from_account}','${fromaccoumt[0].store_ID}','Store Comission Pay','EXPENCE',
                        ${pay_amount},0,${frombalance},'${date}', '0'`,
          req.hostname,
          req.protocol
        )) == -1
      ) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/validate");
      }

      req.flash("success", "Payment Success Full !!!!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log();
  }
});

router.get("/viewcomission/:id", auth, async (req, res) => {
  let id = req.params.id;
  const accessdata = await access(req.user);

  console.log("id", id);
  console.log("req.user", req.user);
  let store = req.user.store;
  console.log(store, "store");
  console.log(accessdata, "accessdata");

  if (store == "" && accessdata.mutibranch == true) {
    if (id == "commission") {
      var comission = await DataFind(
        "SELECT o.order_id ,s.shop_commission , o.gross_total , o.order_date , o.master_comission , s.name as store_name  FROM tbl_order o JOIN tbl_store s ON s.id=o.store_id WHERE o.commission_status ='1' "
      );
      res.render("commission", {
        comission: comission,
        paidcomission: [],
        due: [],
        accessdata,
        status:'1',
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("comission1", comission);
    } else if (id == "paidcommission") {
      var paidcomission = await DataFind(
        "SELECT com.*, s.name FROM tbl_commision com JOIN  tbl_store s ON s.id = com.store_id"
      );

      res.render("commission", {
        comission: [],
        paidcomission: paidcomission,
        due: [],
        accessdata,
status:'2',
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("paidcomission", paidcomission);
    } else if (id == "duecommission") {
      var commissionDueList = await DataFind(`
  SELECT 
      orders.store_id,
      orders.store_name,
      orders.total_order_amount,
      IFNULL(paid.total_paid_commission, 0) AS total_paid_commission,
      (orders.total_order_amount - IFNULL(paid.total_paid_commission, 0)) AS due_amount
  FROM 
  (
      SELECT 
          o.store_id,
          s.name AS store_name,
          SUM(o.master_comission) AS total_order_amount
      FROM 
          tbl_order o
      JOIN 
          tbl_store s ON s.id = o.store_id
     WHERE 
          o.commission_status = '1'
      GROUP BY 
          o.store_id
  ) AS orders
  LEFT JOIN 
  (
      SELECT 
          com.store_id,
          SUM(com.amount) AS total_paid_commission
      FROM 
          tbl_commision com
      GROUP BY 
          com.store_id
  ) AS paid 
  ON orders.store_id = paid.store_id
  WHERE (orders.total_order_amount - IFNULL(paid.total_paid_commission, 0)) > 0.01
  `);

      res.render("commission", {
        comission: [],
        paidcomission: [],
        due: commissionDueList,
        accessdata,
        status:'3',
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("commissionDueList", commissionDueList);
    }
  } else {
    let userData = await DataFind(
      `SELECT * FROM tbl_admin WHERE id='${req.user.id}'`
    );

    if (id == "commission") {
      var comission = await DataFind(
        `SELECT o.order_id ,s.shop_commission , o.gross_total , o.order_date , o.master_comission , s.name as store_name  FROM tbl_order o JOIN tbl_store s ON s.id=o.store_id 
     WHERE store_id='${userData[0].store_ID}' AND o.commission_status='1' `
      );

      res.render("commission", {
        comission: comission,
        paidcomission: [],
        due: [],
        status:'1',
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("comission", comission);
    } else if (id == "paidcommission") {
      var paidcomission = await DataFind(
        `SELECT com.*, s.name FROM tbl_commision com JOIN  tbl_store s ON s.id = com.store_id WHERE store_id='${userData[0].store_ID}'`
      );

      res.render("commission", {
        comission: [],
        paidcomission: paidcomission,
        due: [],
        status:'2',
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("paidcomission", paidcomission);
    } else if (id == "duecommission") {
      var commissionDueList = [];

      res.render("commission", {
        comission: [],
        paidcomission: [],
        due: commissionDueList,
        status:'3',
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
      console.log("commissionDueList", commissionDueList);
    }
  }
});

module.exports = router;
