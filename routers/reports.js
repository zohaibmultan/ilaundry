const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
var Excel = require("exceljs");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind
} = require("../middelwer/databaseQurey");
//>>>>>>>>>>Daily Reports<<<<<<<<<<<<<
router.get("/daily", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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

console.log(rolldetail[0]);


    if (rolldetail[0].rollType == 'master' && rolldetail[0].reports.includes("read")) {
      var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
      var orders = await DataFind(
        "SELECT COUNT(*) as status_count FROM `tbl_order` WHERE DATE(order_date) = CURDATE() "
      );
      var ordersdeliver = await DataFind(
        "SELECT COUNT(*) as status_count FROM `tbl_order` WHERE order_status=4 AND DATE(stutus_change_date) = CURDATE()"
      );
      var orderstotalseal = await DataFind(
        "SELECT SUM(`gross_total`) as totalsale FROM `tbl_order` WHERE  DATE(order_date) = CURDATE() "
      );
      var orderspayment = await DataFind(
        "SELECT SUM(`debit_amount`) as expence, SUM(`credit_amount`) as payment FROM `tbl_transections` WHERE  DATE(date) = CURDATE()"
      );

      console.log("orders", orders);
    } else if (rolldetail[0].rollType == 'store' && rolldetail[0].reports.includes("read")) {
      var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
      var orders = await DataFind(
        "SELECT COUNT(*) as status_count FROM `tbl_order` WHERE store_id=" +
          store +
          " AND DATE(order_date) = CURDATE() "
      );
      var ordersdeliver = await DataFind(
        "SELECT COUNT(*) as status_count FROM `tbl_order` WHERE store_id=" +
          store +
          " AND order_status=4 AND DATE(stutus_change_date) = CURDATE()"
      );
      var orderstotalseal = await DataFind(
        "SELECT SUM(`gross_total`) as totalsale FROM `tbl_order` WHERE store_id=" +
          store +
          " AND DATE(order_date) = CURDATE() "
      );
      var orderspayment = await DataFind(
        "SELECT SUM(`debit_amount`) as expence, SUM(`credit_amount`) as payment FROM `tbl_transections` WHERE store_id=" +
          store +
          " AND DATE(date) = CURDATE()"
      );
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    orders.length > 0 ? (orders = orders[0].status_count) : (orders = 0);
    ordersdeliver.length > 0
      ? (ordersdeliver = ordersdeliver[0].status_count)
      : (ordersdeliver = 0);

    orderstotalseal.length > 0
      ? orderstotalseal[0].totalsale === null
        ? (orderstotalseal = 0)
        : (orderstotalseal = orderstotalseal[0].totalsale)
      : (orderstotalseal = 0);
    orderspayment.length > 0
      ? orderspayment[0].payment === null
        ? (totalpay = 0)
        : (totalpay = orderspayment[0].payment)
      : (totalpay = 0);
    orderspayment.length > 0
      ? orderspayment[0].expence === null
        ? (expence = 0)
        : (expence = orderspayment[0].expence)
      : (expence = 0);

    res.render("daily_report", {
      accessdata,
      date: new Date(),
      storeList,
      store,
      orders,
      ordersdeliver,
      orderstotalseal,
      totalpay,
      expence,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

// store and date change
router.post("/report", auth, async (req, res) => {
  try {
    const { date, store } = req.body;

    // var orders = await DataFind(`SELECT COUNT(*) as status_count FROM tbl_order WHERE store_id=${store} AND DATE(order_date) = DATE(${date})`)
    var orders = await DataFind(
      `SELECT COUNT(*) as status_count FROM tbl_order WHERE store_id='${store}' AND DATE(order_date) = '${date}' `
    );
    // var ordersdeliver = await DataFind("SELECT COUNT(*) as status_count FROM tbl_order WHERE store_id="+store+" AND order_status=4 AND DATE(stutus_change_date) = "+date+" ")
    var ordersdeliver = await DataFind(
      `SELECT COUNT(*) as status_count FROM tbl_order WHERE store_id='${store}' AND order_status=4 AND DATE(stutus_change_date) = '${date}' `
    );

    var orderstotalseal = await DataFind(
      `SELECT SUM(gross_total) as totalsale FROM tbl_order WHERE store_id='${store}' AND DATE(order_date) = '${date}' `
    );
    // var orderspayment = await DataFind("SELECT SUM(`debit_amount`) as expence, SUM(`credit_amount`) as payment FROM `tbl_transections` WHERE store_id="+store+" AND DATE(date) = "+date+" ")
    var orderspayment = await DataFind(
      `SELECT SUM(debit_amount) as expence, SUM(credit_amount) as payment FROM tbl_transections WHERE store_id='${store}' AND DATE(date) = '${date}' `
    );

    orderstotalseal[0].totalsale === null
      ? (orderstotalseal = 0)
      : (orderstotalseal = orderstotalseal[0].totalsale);
    orderspayment[0].payment === null
      ? (totalpay = 0)
      : (totalpay = orderspayment[0].payment);
    orderspayment[0].expence === null
      ? (expence = 0)
      : (expence = orderspayment[0].expence);

    res.status(200).json({
      date,
      store,
      orders: orders[0].status_count,
      ordersdeliver: ordersdeliver[0].status_count,
      orderstotalseal,
      totalpay,
      expence,
    });
  } catch (error) {
    console.log(error);
  }
});

//>>>>>>>>>>Orders Reports<<<<<<<<<<<<<
router.get("/order", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
    if (rolldetail[0].rollType == 'master' &&  rolldetail[0].reports.includes("read")) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var storeList = await DataFind(
          "SELECT * FROM tbl_store WHERE status=1"
        );
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                 tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id  `;
      } else {
         var storeID = await DataFind(`SELECT * FROM tbl_admin WHERE  id= ${id}`)

        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
               tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${storeID[0].store_ID}`;
      }
    } else if (rolldetail[0].rollType == 'store' &&  rolldetail[0].reports.includes("read")) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
            tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
            tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${store}`;
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
    const orderdata = await DataFind(qury);

    const Ordersatus = await DataFind("SELECT * FROM tbl_orderstatus");

    res.render("order_report", {
      accessdata,
      storeList,
      store,
      Ordersatus,
      orderdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/export-order/:id", auth, async (req, res) => {
  try {
    const startdate = req.params.id.split("+")[0];
    const store = req.params.id.split("+")[1];
    const enddate = req.params.id.split("+")[2];

    if (startdate && enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
        tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
        tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${store} AND order_date >= '${startdate}' AND order_date <=  '${enddate}'`;
    } else if (enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
        tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
        tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${store} AND order_date <=  '${enddate}'`;
    } else if (startdate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
        tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
        tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${store} AND order_date >= '${startdate}'`;
    } else {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
        tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
        tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id=${store}`;
    }

    const data = await DataFind(qury);

    console.log(222222222);

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Order Date", key: "order_date", width: 35 },
      { header: "Order ID", key: "order_id", width: 35 },
      { header: "Customer Name", key: "custoname", width: 40 },
      { header: "Order Amount", key: "gross_total", width: 35 },
      { header: "Status", key: "status", width: 30 },
    ];

    data.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "orderreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/orderreports", auth, async (req, res) => {
  try {
    const { startdate, store, enddate, status } = req.body;

    const status_qury = `SELECT * FROM tbl_orderstatus where tbl_orderstatus.status='${status}'`;
    const status_id = await DataFind(status_qury);
    // console.log("status_id" , status_id[0].id);

    if (status == "0") {
      if (startdate && enddate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date >= '${startdate}' AND order_date <=  '${enddate}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date <=  '${enddate}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date >= '${startdate}' `;
      } else if (status) {
        // AND order_status = '${status_id[0].id}'
        // var qury = `SELECT * FROM tbl_order where order_status = '${status_id[0].id}'`
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}'`;
      } else {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}'`;
      }
    } else {
      if (startdate && enddate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date >= '${startdate}' AND order_date <=  '${enddate}' AND order_status = '${status_id[0].id}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date <=  '${enddate}' AND order_status = '${status_id[0].id}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_date >= '${startdate}' AND order_status = '${status_id[0].id}'`;
      } else if (status) {
        // AND order_status = '${status_id[0].id}'
        // var qury = `SELECT * FROM tbl_order where order_status = '${status_id[0].id}'`
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_status = '${status_id[0].id}' AND order_status = '${status_id[0].id}'`;
      } else {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_order.gross_total,tbl_customer.name as custoname,
                tbl_orderstatus.status FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id join tbl_orderstatus on
                tbl_order.order_status=tbl_orderstatus.id where tbl_order.store_id='${store}' AND order_status = '${status_id[0].id}'`;
      }
    }

    const orderdata = await DataFind(qury);

    res.status(200).json({ startdate, store, enddate, orderdata });
  } catch (error) {
    console.log(error);
  }
});

// >>>>>>> Sales Reports <<<<<<<
router.get("/sales", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
    if (rolldetail[0].rollType == 'master' && rolldetail[0].reports.includes("read")) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
                FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id`;
      } else {
         var storeID = await DataFind(`SELECT * FROM tbl_admin WHERE  id= ${id}`)

        var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
                FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${storeID[0].store_ID}`;
      }
    } else if (rolldetail[0].rollType == 'store' && rolldetail[0].reports.includes("read")) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
            FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store}`;
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
    const salesdata = await DataFind(qury);
     
    const Ordersatus = await DataFind("SELECT * FROM tbl_orderstatus ");

    res.render("Sales_report", {
      accessdata,
      storeList,
      store,
      Ordersatus,
      salesdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/salesreports", auth, async (req, res) => {
  try {
    const { startdate, store, enddate } = req.body;
    if (startdate && enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
            FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date >= '${startdate}' AND order_date <=  '${enddate}'`;
    } else if (enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
            FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date <=  '${enddate}'`;
    } else if (startdate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
            FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date >= '${startdate}'`;
    } else {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
            FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store}`;
    }

    const salesdata = await DataFind(qury);

    res.status(200).json({ startdate, store, enddate, salesdata });
  } catch (error) {
    console.log(error);
  }
});

router.get("/export-sales/:id", auth, async (req, res) => {
  try {
    const startdate = req.params.id.split("+")[0];
    const store = req.params.id.split("+")[1];
    const enddate = req.params.id.split("+")[2];

    if (startdate && enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
        FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date >= '${startdate}' AND order_date <=  '${enddate}'`;
    } else if (enddate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
        FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date <=  '${enddate}'`;
    } else if (startdate) {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
        FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store} AND order_date >= '${startdate}'`;
    } else {
      var qury = `SELECT tbl_order.id,tbl_order.order_date,tbl_order.order_id,tbl_customer.name as custoname,sub_total,addon_price,extra_discount,coupon_discount,tax_amount,tbl_order.gross_total
        FROM tbl_order join tbl_customer on tbl_order.customer_id=tbl_customer.id where tbl_order.store_id=${store}`;
    }

    const data = await DataFind(qury);

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Order Date", key: "order_date", width: 35 },
      { header: "Order ID", key: "order_id", width: 35 },
      { header: "Customer Name", key: "custoname", width: 40 },
      { header: "Sub Total", key: "sub_total", width: 35 },
      { header: "Addon Total", key: "addon_price", width: 35 },
      { header: "Extra Discount", key: "extra_discount", width: 35 },
      { header: "Coupon Discount", key: "coupon_discount", width: 35 },
      { header: "Tax Amount", key: "tax_amount", width: 35 },
      { header: "Order Amount", key: "gross_total", width: 35 },
    ];

    data.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "orderreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
  }
});

// >>>>>> Expence report >>>>>>>>>>>>>>
router.get("/expence", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
    if ( rolldetail[0].rollType == 'master' &&  rolldetail[0].reports.includes("read")) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id`;
      } else {
        
        var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store}`;
      }
    } else if ( rolldetail[0].rollType == 'store' && rolldetail[0].reports.includes("read")) {
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store}`;
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
    const Expencedata = await DataFind(qury);
    const Ordersatus = await DataFind("SELECT * FROM tbl_orderstatus ");

    res.render("Expence_report", {
      accessdata,
      storeList,
      store,
      Ordersatus,
      Expencedata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/expencereport", auth, async (req, res) => {
  try {
    const { startdate, store, enddate } = req.body;
    if (startdate && enddate) {
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}' AND tbl_expense.date <=  '${enddate}'`;
    } else if (enddate) {
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date <=  '${enddate}'`;
    } else if (startdate) {
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}'`;
    } else {
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store}`;
    }

    const expencedata = await DataFind(qury);

    res.status(200).json({ startdate, store, enddate, expencedata });
  } catch (error) {
    console.log(error);
  }
});

router.get("/export-expence/:id", auth, async (req, res) => {
  try {
    const startdate = req.params.id.split("+")[0];
    const store = req.params.id.split("+")[1];
    const enddate = req.params.id.split("+")[2];
    if (startdate && enddate) {
      console.log(11111111);
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
        join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}' AND tbl_expense.date <=  '${enddate}'`;
    } else if (enddate) {
      console.log(2222222);
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
        join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date <=  '${enddate}'`;
    } else if (startdate) {
      console.log(33333);
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
        join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}'`;
    } else {
      console.log(44444);
      var qury = `SELECT tbl_expense.id,tbl_expense.date,tbl_exp_cat.cat_name,tbl_expense.amount,tbl_expense.taxpercent,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount ,tbl_account.ac_name FROM tbl_expense
        join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id join tbl_account on tbl_expense.payment_mode=tbl_account.id where tbl_expense.store_ID=${store}`;
    }

    const data = await DataFind(qury);

    console.log(data);

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Expence Date", key: "date", width: 35 },
      { header: "Towards", key: "cat_name", width: 35 },
      { header: "Expence Amount", key: "amount", width: 40 },
      { header: "Tax %", key: "taxpercent", width: 35 },
      { header: "Tax Amount", key: "taxamount", width: 35 },
      { header: "Payment Mode", key: "ac_name", width: 35 },
    ];

    data.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "orderreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
  }
});

//>>>>>>>>>> tax Reports<<<<<<<<<<<<<
router.get("/tax", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
    if (rolldetail[0].rollType == 'master' && rolldetail[0].reports.includes("read")) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id`;
      } else {
         var storeID = await DataFind(`SELECT * FROM tbl_admin WHERE  id= ${id}`)

        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${storeID[0].store_ID}`;
      }
    } else if (rolldetail[0].rollType == 'store' && rolldetail[0].reports.includes("read")) {
      var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store}`;
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
    var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");
    const taxdata = await DataFind(qury);

    res.render("tax_report", {
      accessdata,
      storeList,
      store,
      taxdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/export-tax/:id", auth, async (req, res) => {
  try {
    const startdate = req.params.id.split("+")[0];
    const store = req.params.id.split("+")[1];
    const enddate = req.params.id.split("+")[2];
    const filter = req.params.id.split("+")[3];

    if (filter == 0) {
      if (startdate && enddate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}' AND tbl_expense.date <=  '${enddate}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date <=  '${enddate}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}'`;
      } else {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
            join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store}`;
      }
    } else {
      if (startdate && enddate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
            tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
            tbl_order.store_id=${store} AND tbl_order.order_date >= '${startdate}' AND tbl_order.order_date <=  '${enddate}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
            tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
            tbl_order.store_id=${store} AND tbl_order.order_date <=  '${enddate}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
            tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
            tbl_order.store_id=${store} AND tbl_order.order_date >= '${startdate}'`;
      } else {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
            tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
            tbl_order.store_id=${store}`;
      }
    }

    const data = await DataFind(qury);

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("orderreport");

    worksheet.columns = [
      { header: "Date", key: "date", width: 35 },
      { header: "Particulars", key: "particulars", width: 35 },
      { header: "Before Tax", key: "befortax", width: 40 },
      { header: "Tax Amount", key: "taxamount:", width: 35 },
      { header: "Total Amount", key: "amount", width: 30 },
    ];

    data.forEach(function (row) {
      worksheet.addRow(row);
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "orderreport.xlsx"
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/taxreport", auth, async (req, res) => {
  try {
    const { store, startdate, enddate, filter } = req.body;
    if (filter == 0) {
      if (startdate && enddate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}' AND tbl_expense.date <=  '${enddate}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date <=  '${enddate}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store} AND tbl_expense.date >= '${startdate}'`;
      } else {
        var qury = `SELECT tbl_expense.date,tbl_exp_cat.cat_name as particulars,tbl_expense.amount,((tbl_expense.amount * tbl_expense.taxpercent)/100) as taxamount , ((tbl_expense.amount-(tbl_expense.amount * tbl_expense.taxpercent)/100)) as befortax FROM tbl_expense
                join tbl_exp_cat on tbl_expense.category=tbl_exp_cat.id where tbl_expense.store_ID=${store}`;
      }
    } else {
      if (startdate && enddate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
                tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
                tbl_order.store_id=${store} AND tbl_order.order_date >= '${startdate}' AND tbl_order.order_date <=  '${enddate}'`;
      } else if (enddate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
                tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
                tbl_order.store_id=${store} AND tbl_order.order_date <=  '${enddate}'`;
      } else if (startdate) {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
                tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
                tbl_order.store_id=${store} AND tbl_order.order_date >= '${startdate}'`;
      } else {
        var qury = `SELECT tbl_order.order_date as date,tbl_order.order_id as particulars,tbl_order.gross_total as amount,
                tbl_order.tax_amount as taxamount, (tbl_order.gross_total - tbl_order.tax_amount) as befortax FROM tbl_order  where 
                tbl_order.store_id=${store}`;
      }
    }

    const taxdata = await DataFind(qury);

    res.status(200).json({ store, startdate, enddate, filter, taxdata });
  } catch (error) {
    console.log(error);
  }
});

// >>>>>>>>>> PROFIT AND LOSS REPORT <<<<<<<<<<
async function getProfitLossData({ store, startdate, enddate }) {
  let orderWhere = [];
  let expenseWhere = [];

  if (store && store != "0" && store != "all") {
    orderWhere.push(`tbl_order.store_id = ${Number(store)}`);
    expenseWhere.push(`tbl_expense.store_ID = ${Number(store)}`);
  }

  if (startdate) {
    orderWhere.push(`DATE(tbl_order.order_date) >= '${startdate}'`);
    expenseWhere.push(`DATE(tbl_expense.date) >= '${startdate}'`);
  }

  if (enddate) {
    orderWhere.push(`DATE(tbl_order.order_date) <= '${enddate}'`);
    expenseWhere.push(`DATE(tbl_expense.date) <= '${enddate}'`);
  }

  expenseWhere.push(`(tbl_expense.delet_flage = 0 OR tbl_expense.delet_flage IS NULL)`);

  const orderWhereSql = orderWhere.length > 0 ? `WHERE ${orderWhere.join(" AND ")}` : "";
  const expenseWhereSql = expenseWhere.length > 0 ? `WHERE ${expenseWhere.join(" AND ")}` : "";

  // 1. Revenue Aggregation
  const revSummaryQuery = `
    SELECT 
      COUNT(*) as order_count,
      COALESCE(SUM(sub_total), 0) as total_subtotal,
      COALESCE(SUM(addon_price), 0) as total_addon,
      COALESCE(SUM(extra_discount), 0) as total_extra_discount,
      COALESCE(SUM(coupon_discount), 0) as total_coupon_discount,
      COALESCE(SUM(tax_amount), 0) as total_tax_amount,
      COALESCE(SUM(gross_total), 0) as total_gross,
      COALESCE(SUM(paid_amount), 0) as total_paid
    FROM tbl_order
    ${orderWhereSql}
  `;
  const revSummaryRows = await DataFind(revSummaryQuery);
  const rev = revSummaryRows[0] || {};

  const totalSubtotal = parseFloat(rev.total_subtotal || 0);
  const totalAddon = parseFloat(rev.total_addon || 0);
  const totalExtraDisc = parseFloat(rev.total_extra_discount || 0);
  const totalCouponDisc = parseFloat(rev.total_coupon_discount || 0);
  const totalDiscounts = totalExtraDisc + totalCouponDisc;
  const grossSales = totalSubtotal + totalAddon;
  const netRevenue = grossSales - totalDiscounts;
  const totalSalesTax = parseFloat(rev.total_tax_amount || 0);
  const totalGross = parseFloat(rev.total_gross || 0);
  const totalPaid = parseFloat(rev.total_paid || 0);
  const orderCount = parseInt(rev.order_count || 0, 10);

  // 2. Expense Aggregation
  const expSummaryQuery = `
    SELECT 
      COUNT(*) as expense_count,
      COALESCE(SUM(amount), 0) as total_expense,
      COALESCE(SUM((amount * COALESCE(taxpercent, 0)) / 100), 0) as total_expense_tax
    FROM tbl_expense
    ${expenseWhereSql}
  `;
  const expSummaryRows = await DataFind(expSummaryQuery);
  const exp = expSummaryRows[0] || {};

  const totalExpense = parseFloat(exp.total_expense || 0);
  const totalExpenseTax = parseFloat(exp.total_expense_tax || 0);
  const expenseCount = parseInt(exp.expense_count || 0, 10);

  // 3. Category Breakdown for Expenses
  const expCatQuery = `
    SELECT 
      COALESCE(tbl_exp_cat.cat_name, 'Uncategorized / Other') as category_name,
      COUNT(*) as count,
      COALESCE(SUM(tbl_expense.amount), 0) as total_amount
    FROM tbl_expense
    LEFT JOIN tbl_exp_cat ON tbl_expense.category = tbl_exp_cat.id
    ${expenseWhereSql}
    GROUP BY tbl_expense.category, tbl_exp_cat.cat_name
    ORDER BY total_amount DESC
  `;
  const categoryBreakdown = await DataFind(expCatQuery);

  // 4. Detailed Orders (Limit 500)
  const ordersListQuery = `
    SELECT 
      tbl_order.id,
      tbl_order.order_id,
      DATE_FORMAT(tbl_order.order_date, '%Y-%m-%d') as order_date,
      COALESCE(tbl_customer.name, 'Walk-in') as customer_name,
      COALESCE(tbl_store.name, 'Store') as store_name,
      tbl_order.sub_total,
      tbl_order.addon_price,
      (tbl_order.extra_discount + tbl_order.coupon_discount) as total_discount,
      (tbl_order.sub_total + tbl_order.addon_price - (tbl_order.extra_discount + tbl_order.coupon_discount)) as net_amount,
      tbl_order.tax_amount,
      tbl_order.gross_total,
      tbl_order.paid_amount
    FROM tbl_order
    LEFT JOIN tbl_customer ON tbl_order.customer_id = tbl_customer.id
    LEFT JOIN tbl_store ON tbl_order.store_id = tbl_store.id
    ${orderWhereSql}
    ORDER BY tbl_order.order_date DESC, tbl_order.id DESC
    LIMIT 500
  `;
  const ordersList = await DataFind(ordersListQuery);

  // 5. Detailed Expenses (Limit 500)
  const expensesListQuery = `
    SELECT 
      tbl_expense.id,
      DATE_FORMAT(tbl_expense.date, '%Y-%m-%d') as expense_date,
      COALESCE(tbl_exp_cat.cat_name, 'Uncategorized') as category_name,
      COALESCE(tbl_expense.towards, '-') as towards,
      COALESCE(tbl_account.ac_name, 'Cash / Account') as account_name,
      COALESCE(tbl_store.name, 'Store') as store_name,
      tbl_expense.amount,
      tbl_expense.taxpercent,
      ((tbl_expense.amount * COALESCE(tbl_expense.taxpercent, 0)) / 100) as tax_amount
    FROM tbl_expense
    LEFT JOIN tbl_exp_cat ON tbl_expense.category = tbl_exp_cat.id
    LEFT JOIN tbl_account ON tbl_expense.payment_mode = tbl_account.id
    LEFT JOIN tbl_store ON tbl_expense.store_ID = tbl_store.id
    ${expenseWhereSql}
    ORDER BY tbl_expense.date DESC, tbl_expense.id DESC
    LIMIT 500
  `;
  const expensesList = await DataFind(expensesListQuery);

  // 6. Net Profit / Loss Calculations
  const netProfit = netRevenue - totalExpense;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;
  const netTax = totalSalesTax - totalExpenseTax;

  return {
    metrics: {
      grossSales: grossSales.toFixed(2),
      totalSubtotal: totalSubtotal.toFixed(2),
      totalAddon: totalAddon.toFixed(2),
      totalDiscounts: totalDiscounts.toFixed(2),
      netRevenue: netRevenue.toFixed(2),
      totalSalesTax: totalSalesTax.toFixed(2),
      totalGross: totalGross.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      orderCount,
      totalExpense: totalExpense.toFixed(2),
      totalExpenseTax: totalExpenseTax.toFixed(2),
      expenseCount,
      netProfit: netProfit.toFixed(2),
      profitMargin: profitMargin.toFixed(2),
      netTax: netTax.toFixed(2),
      isProfit: netProfit >= 0
    },
    categoryBreakdown,
    ordersList,
    expensesList
  };
}

// GET /report/profit-loss
router.get("/profit-loss", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].reports ||
      !rolldetail[0].reports.includes("read")
    ) {
      req.flash("error", "You are not authorized to view reports");
      return res.redirect(req.get("Referrer") || "/");
    }

    const isMaster = rolldetail[0].rollType === "master";
    var storeList = await DataFind("SELECT * FROM tbl_store WHERE status=1");

    // Default Date Range: Current Month
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const startdate = `${year}-${month}-01`;
    const enddate = `${year}-${month}-${day}`;
    const selectedStore = isMaster ? req.query.store || "0" : store;

    const data = await getProfitLossData({
      store: selectedStore,
      startdate,
      enddate
    });

    res.render("profit_loss_report", {
      accessdata,
      storeList,
      store: selectedStore,
      isMaster,
      startdate,
      enddate,
      metrics: data.metrics,
      categoryBreakdown: data.categoryBreakdown,
      ordersList: data.ordersList,
      expensesList: data.expensesList,
      language: req.language_data,
      language_name: req.language_name
    });
  } catch (error) {
    console.error("Error in /report/profit-loss:", error);
    req.flash("error", "Error loading Profit and Loss report");
    res.redirect("/report/daily");
  }
});

// POST /report/profit-loss-data (AJAX)
router.post("/profit-loss-data", auth, async (req, res) => {
  try {
    const { store, startdate, enddate } = req.body;
    const data = await getProfitLossData({ store, startdate, enddate });
    res.status(200).json({
      success: true,
      store,
      startdate,
      enddate,
      metrics: data.metrics,
      categoryBreakdown: data.categoryBreakdown,
      ordersList: data.ordersList,
      expensesList: data.expensesList
    });
  } catch (error) {
    console.error("Error in /report/profit-loss-data:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /report/export-profit-loss/:id
router.get("/export-profit-loss/:id", auth, async (req, res) => {
  try {
    const parts = req.params.id.split("+");
    const startdate = parts[0] || "";
    const store = parts[1] || "0";
    const enddate = parts[2] || "";

    const data = await getProfitLossData({ store, startdate, enddate });

    let workbook = new Excel.Workbook();
    workbook.creator = "iCleaners";
    workbook.lastModifiedBy = "iCleaners";
    workbook.created = new Date();

    // SHEET 1: Executive Summary
    let sheetSummary = workbook.addWorksheet("P&L Summary");
    sheetSummary.columns = [
      { header: "Financial Indicator", key: "indicator", width: 40 },
      { header: "Amount", key: "amount", width: 25 },
      { header: "Notes / Description", key: "notes", width: 45 }
    ];

    sheetSummary.addRow({
      indicator: "REPORT PERIOD",
      amount: `${startdate || "All Time"} to ${enddate || "Present"}`,
      notes: store && store !== "0" ? `Store ID: ${store}` : "All Stores"
    });
    sheetSummary.addRow({});

    sheetSummary.addRow({
      indicator: "1. OPERATING REVENUE",
      amount: "",
      notes: ""
    });
    sheetSummary.addRow({
      indicator: "   Service Subtotal",
      amount: parseFloat(data.metrics.totalSubtotal),
      notes: "Base service charges"
    });
    sheetSummary.addRow({
      indicator: "   Addon Charges",
      amount: parseFloat(data.metrics.totalAddon),
      notes: "Extra addons & customized care"
    });
    sheetSummary.addRow({
      indicator: "   Total Discounts (Coupons & Extra)",
      amount: -parseFloat(data.metrics.totalDiscounts),
      notes: "Reductions given to customers"
    });
    sheetSummary.addRow({
      indicator: "NET OPERATING REVENUE",
      amount: parseFloat(data.metrics.netRevenue),
      notes: "Subtotal + Addons - Discounts"
    });
    sheetSummary.addRow({});

    sheetSummary.addRow({
      indicator: "2. OPERATING EXPENSES",
      amount: "",
      notes: ""
    });
    data.categoryBreakdown.forEach((cat) => {
      sheetSummary.addRow({
        indicator: `   ${cat.category_name}`,
        amount: parseFloat(cat.total_amount),
        notes: `${cat.count} expense entries`
      });
    });
    sheetSummary.addRow({
      indicator: "TOTAL OPERATING EXPENSES",
      amount: parseFloat(data.metrics.totalExpense),
      notes: "Sum of all operating expenses"
    });
    sheetSummary.addRow({});

    sheetSummary.addRow({
      indicator: "3. BOTTOM LINE RESULTS",
      amount: "",
      notes: ""
    });
    sheetSummary.addRow({
      indicator: data.metrics.isProfit ? "NET PROFIT" : "NET LOSS",
      amount: parseFloat(data.metrics.netProfit),
      notes: `${data.metrics.profitMargin}% Profit Margin`
    });
    sheetSummary.addRow({});

    sheetSummary.addRow({
      indicator: "4. TAX OVERVIEW (Informational)",
      amount: "",
      notes: ""
    });
    sheetSummary.addRow({
      indicator: "   Sales Tax Collected (Output Tax)",
      amount: parseFloat(data.metrics.totalSalesTax),
      notes: "Collected from customer orders"
    });
    sheetSummary.addRow({
      indicator: "   Expense Tax Paid (Input Tax)",
      amount: parseFloat(data.metrics.totalExpenseTax),
      notes: "Paid on business expenses"
    });
    sheetSummary.addRow({
      indicator: "   Net Tax Position",
      amount: parseFloat(data.metrics.netTax),
      notes: "Output Tax - Input Tax"
    });

    // SHEET 2: Orders Detail
    let sheetOrders = workbook.addWorksheet("Orders Detail");
    sheetOrders.columns = [
      { header: "Order Date", key: "order_date", width: 16 },
      { header: "Order ID", key: "order_id", width: 18 },
      { header: "Customer Name", key: "customer_name", width: 25 },
      { header: "Store", key: "store_name", width: 20 },
      { header: "Subtotal", key: "sub_total", width: 15 },
      { header: "Addon", key: "addon_price", width: 15 },
      { header: "Discount", key: "total_discount", width: 15 },
      { header: "Net Amount", key: "net_amount", width: 16 },
      { header: "Tax", key: "tax_amount", width: 15 },
      { header: "Gross Total", key: "gross_total", width: 16 }
    ];
    data.ordersList.forEach((ord) => sheetOrders.addRow(ord));

    // SHEET 3: Expenses Detail
    let sheetExpenses = workbook.addWorksheet("Expenses Detail");
    sheetExpenses.columns = [
      { header: "Expense Date", key: "expense_date", width: 16 },
      { header: "Category", key: "category_name", width: 28 },
      { header: "Towards / Description", key: "towards", width: 30 },
      { header: "Payment Account", key: "account_name", width: 22 },
      { header: "Store", key: "store_name", width: 20 },
      { header: "Amount", key: "amount", width: 16 },
      { header: "Tax Amount", key: "tax_amount", width: 16 }
    ];
    data.expensesList.forEach((expRow) => sheetExpenses.addRow(expRow));

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="Profit_and_Loss_Report_${startdate}_to_${enddate}.xlsx"`
    );
    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  } catch (error) {
    console.error("Error exporting Profit and Loss:", error);
    res.status(500).send("Error generating Excel export");
  }
});

module.exports = router;

