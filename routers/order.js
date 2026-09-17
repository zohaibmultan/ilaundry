const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
const nodemailer = require("nodemailer");
let sendNotification = require("../middelwer/send");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind
} = require("../middelwer/databaseQurey");

async function idfororder() {
  const orderiddata = await DataFind(
    `SELECT id FROM tbl_order ORDER BY ID DESC LIMIT 1`
  );

  if (orderiddata.length > 0) {
    var n = ++orderiddata[0].id;
  } else {
    var n = 1;
  }

  if (n < 10) {
    return "#ORD000" + n.toString();
  } else if (n < 100) {
    return "#ORD00" + n.toString();
  } else if (n < 1000) {
    return "#ORD0" + n.toString();
  } else {
    return "#ORD" + n;
  }
}

async function getStaffScope(userId, loginas) {
  if (loginas == 0) return { isStaff: false, staffStoreId: null };
  const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${userId}`);
  const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
  const staffStoreId = isStaff ? adminData[0].store_ID : null;
  return { isStaff, staffStoreId };
}

async function buildOrderListQuery(user, statusParam, searchParam, limit = 10, offset = 0) {
  const { id, roll, store, loginas } = user;
  const { isStaff, staffStoreId } = await getStaffScope(id, loginas);

  // Normalize status filter
  let statusCondition = "";
  if (
    statusParam &&
    !["all", "ALL", "__ALL__ORDERS__00911", "__ALL__ORDERS__00911#", "", "0", "undefined", "null"].includes(String(statusParam).trim())
  ) {
    const cleanStatus = String(statusParam).trim().replace(/'/g, "\\'");
    const orderStatus = await DataFind(
      `SELECT * FROM tbl_orderstatus WHERE status = '${cleanStatus}' OR id = '${cleanStatus}'`
    );
    if (orderStatus.length > 0) {
      statusCondition = `tbl_order.order_status = '${orderStatus[0].id}'`;
    }
  }

  // Normalize search filter
  let searchCondition = "";
  if (searchParam && typeof searchParam === "string" && searchParam.trim().length > 0) {
    const cleanSearch = searchParam.trim().replace(/'/g, "\\'");
    searchCondition = `(tbl_order.order_id LIKE '%${cleanSearch}%' OR tbl_customer.name LIKE '%${cleanSearch}%' OR tbl_customer.number LIKE '%${cleanSearch}%' OR tbl_store.name LIKE '%${cleanSearch}%' OR tbl_orderstatus.status LIKE '%${cleanSearch}%' OR CAST(tbl_order.id AS CHAR) LIKE '%${cleanSearch}%')`;
  }

  let login = "store";
  let scopeConditions = [];

  if (loginas == 0) {
    login = "customer";
    scopeConditions.push(`tbl_order.customer_id = ${id}`);
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

    if (isStaff && staffStoreId) {
      login = "store";
      scopeConditions.push(`tbl_order.store_id = '${staffStoreId}'`);
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      rolldetail[0].orders &&
      rolldetail[0].orders.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy && multiy.length > 0 && multiy[0].type == 1) {
        login = "master";
        // master can see all stores
      } else {
        login = "store";
        const storeID = await DataFind(`SELECT * FROM tbl_admin WHERE id = ${id}`);
        const sId = (storeID && storeID.length > 0) ? storeID[0].store_ID : store;
        scopeConditions.push(`tbl_order.store_id = '${sId}'`);
      }
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "store" &&
      rolldetail[0].orders &&
      rolldetail[0].orders.includes("read")
    ) {
      login = "store";
      scopeConditions.push(`tbl_order.store_id = ${store}`);
    } else {
      const adminData = await DataFind(`SELECT * FROM tbl_admin WHERE id = ${id}`);
      if (adminData.length > 0) {
        const multiy = await DataFind("SELECT type FROM tbl_master_shop");
        if (multiy && multiy.length > 0 && multiy[0].type == 1) {
          login = "master";
        } else {
          login = "store";
          scopeConditions.push(`tbl_order.store_id = '${adminData[0].store_ID}'`);
        }
      } else {
        return { authorized: false };
      }
    }
  }

  const allConditions = [...scopeConditions];
  if (statusCondition) allConditions.push(statusCondition);
  if (searchCondition) allConditions.push(searchCondition);

  const whereClause = allConditions.length > 0 ? `WHERE ${allConditions.join(" AND ")}` : "";
  const query = `
    SELECT tbl_order.*, 
           COALESCE(tbl_customer.name, "") as name, 
           COALESCE(tbl_customer.number, "") as number,
           COALESCE(tbl_store.name, "") as storeName, 
           COALESCE(tbl_orderstatus.status, "") as orderStatus  
    FROM tbl_order 
    LEFT JOIN tbl_orderstatus ON tbl_order.order_status = tbl_orderstatus.id
    LEFT JOIN tbl_customer ON tbl_order.customer_id = tbl_customer.id 
    LEFT JOIN tbl_store ON tbl_order.store_id = tbl_store.id
    ${whereClause} 
    ORDER BY tbl_order.id DESC 
    LIMIT ${limit} OFFSET ${offset}
  `;

  return { authorized: true, query, login, isStaff, staffStoreId };
}

router.get("/list", auth, async (req, res) => {
  try {
    const accessdata = await access(req.user);
    const built = await buildOrderListQuery(req.user, req.query.status, req.query.search, 10, 0);
    if (!built.authorized) {
      req.flash("error", "You Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const orderlist = await DataFind(built.query);
    const Ordersatus = await DataFind("SELECT * FROM tbl_orderstatus ");

    res.render("order", {
      login: built.login,
      isStaff: built.isStaff,
      staffStoreId: built.staffStoreId,
      Ordersatus,
      orderlist,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("/order/list error:", error);
    res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/getmore", auth, async (req, res) => {
  try {
    const { from, orderstatus, search } = req.body;
    const accessdata = await access(req.user);
    const offset = parseInt(from) || 0;
    const built = await buildOrderListQuery(req.user, orderstatus, search, 10, offset);
    if (!built.authorized) {
      return res.status(403).send({ error: "Unauthorized", orderlists: [] });
    }

    const orderlists = await DataFind(built.query);
    return res.send({
      orderlists,
      accessdata,
      login: built.login,
      isStaff: built.isStaff,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("/order/getmore error:", error);
    res.status(500).send({ error: error.message, orderlists: [] });
  }
});

router.get("/delete/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/order/list");
    }

    const { id, roll, store, loginas } = req.user;
    if (loginas == 0) {
      req.flash("error", "You are not authorized for this");
      return res.redirect(req.get("Referrer") || "/order/list");
    }

    const accessdata = await access(req.user);
    if (accessdata.logas === 'custmor') {
      req.flash("error", "You are not authorized to delete orders");
      return res.redirect("/order/list");
    }

    if (accessdata.topbardata?.is_staff != 0 && (!accessdata.roll?.orders || !accessdata.roll.orders.includes('delete'))) {
      req.flash("error", "You do not have permission to delete orders");
      return res.redirect("/order/list");
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    const orderId = req.params.id;
    let findQuery = `SELECT * FROM tbl_order WHERE id = '${orderId}'`;
    if (isStaff && staffStoreId) {
      findQuery += ` AND store_id = '${staffStoreId}'`;
    } else if (accessdata.login === 'store') {
      findQuery += ` AND store_id = '${store}'`;
    }

    const orderData = await DataFind(findQuery);
    if (!orderData || orderData.length === 0) {
      req.flash("error", "Order not found or unauthorized");
      return res.redirect("/order/list");
    }

    const order = orderData[0];

    // Delete linked order payments
    await DataDelete(`tbl_order_payment`, `order_id = '${order.id}'`, req.hostname, req.protocol);

    // Delete related ledger transactions for this order
    await DataDelete(`tbl_transections`, `transec_detail LIKE '%${order.order_id}%'`, req.hostname, req.protocol);

    // Delete the order itself
    const deleteResult = await DataDelete(`tbl_order`, `id = '${order.id}'`, req.hostname, req.protocol);
    if (deleteResult == -1) {
      req.flash("error", "Error deleting order, please try again");
      return res.redirect("/order/list");
    }

    req.flash("success", `Order #${order.order_id} deleted successfully`);
    return res.redirect("/order/list");
  } catch (error) {
    console.error("Error in /order/delete/:id:", error);
    req.flash("error", "An error occurred while deleting the order");
    return res.redirect("/order/list");
  }
});

router.get("/view/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const orderid = req.params.id;

    const order = await DataFind(
      "SELECT tbl_order.*,tbl_orderstatus.status as status FROM tbl_order join tbl_orderstatus on tbl_order.order_status=tbl_orderstatus.id WHERE tbl_order.id=" +
        orderid +
        ""
    );

    if (!order || order.length === 0) {
      req.flash("error", "Order not found");
      return res.redirect("/order/list");
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    if (isStaff && staffStoreId && order[0].store_id != staffStoreId) {
      req.flash("error", "You are not authorized to view orders from other stores");
      return res.redirect("/order/list");
    }

    var splite_id = order[0].order_id.split(/[A-Z-a-z]/).join("");

    const storedata = await DataFind(
      "SELECT * FROM tbl_store WHERE id=" + order[0].store_id + ""
    );
    const Ordersatus = await DataFind("SELECT * FROM tbl_orderstatus");
    const orderServiceList = await DataFind(
      "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
      order[0].service_list +
      "')"
    );
    const addonlist = await DataFind(
      "SELECT * from tbl_addons WHERE find_in_set(tbl_addons.id,'" +
      order[0].addon_data +
      "')"
    );
    const payments = await DataFind(
      "SELECT tbl_order_payment.*,tbl_account.ac_name FROM tbl_order_payment join tbl_account on tbl_order_payment.payment_account=tbl_account.id WHERE find_in_set(tbl_order_payment.id,'" +
      order[0].payment_data +
      "')"
    );
    const customer = await DataFind(
      "SELECT * FROM tbl_customer WHERE id=" + order[0].customer_id + ""
    );
    const account = await DataFind(
      "SELECT * FROM tbl_account WHERE store_ID=" +
      order[0].store_id +
      "  AND delet_flage != '1' "
    );

    const accessdata = await access(req.user);
    res.render("order_details", {
      order: order[0],
      Ordersatus,
      orderServiceList,
      addonlist,
      payments,
      customer: customer[0],
      storedata: storedata[0],
      account,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
      splite_id,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/changestatus/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/");
    }
    console.log(req.params.id);
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res
        .status(208)
        .json({ status: "error", messge: "your not authorized for this" });
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
    if (rolldetail[0].orders.includes("edit")) {
      const orderid = req.params.id.split(",")[1];
      const statusid = req.params.id.split(",")[0];

      // await DataFind(
      //   `UPDATE tbl_order SET order_status=${statusid},commission_status=${
      //     statusid == "6" ? "0" : "1"
      //   },stutus_change_date=CURRENT_TIMESTAMP WHERE id=${orderid}`
      // );

      const orderupdate = await DataUpdate(`tbl_order`, `order_status=${statusid},commission_status=${statusid == "6" ? "0" : "1"
        },stutus_change_date=CURRENT_TIMESTAMP`,
        `id=${orderid}`, req.hostname, req.protocol);

      if (orderupdate == -1) {
        req.flash("error", "Failed to update order status, please try again");
        return res.redirect("back");
      }


      const storedata =
        await DataFind(`SELECT tbl_order.order_id,tbl_order.store_id,tbl_orderstatus.status,tbl_store.name,
            tbl_store.mobile_number,tbl_store.store_email,tbl_store.city FROM tbl_order join tbl_orderstatus on 
            tbl_order.order_status=tbl_orderstatus.id join tbl_store on tbl_order.store_id=tbl_store.id WHERE tbl_order.id=${orderid}`);

      console.log(111, storedata);
      var data = await DataFind(
        "SELECT * FROM tbl_email WHERE store_id=" + storedata[0].store_id + ""
      );
      console.log(2222, orderid);
      console.log("data", data);

      const order_date = await DataFind(
        `SELECT * FROM tbl_order WHERE id = '${orderid}'`
      );
      const customer_data = await DataFind(
        `SELECT * FROM tbl_customer WHERE id = '${order_date[0].customer_id}'`
      );
      console.log(1111, "customer_data", customer_data);

      if (data.length > 0) {
        if (data[0].status == 1) {
          if (
            data[0].host &&
            data[0].port &&
            data[0].username &&
            data[0].password &&
            data[0].frommail
          ) {
            const transporter = nodemailer.createTransport({
              host: data[0].host,
              port: Number(data[0].port),
              // service: "gmail",
              auth: {
                user: data[0].username,
                pass: data[0].password,
              },
            });
            let mailDetails = {
              from: data[0].frommail,
              // to: 'vivekchovatiya1179@gmail.com',
              to: customer_data[0].email,
              subject: "Email From " + storedata[0].name,
              html:
                "<!DOCTYPE html>" +
                "<html><head><title></title>" +
                "</head><body><div>" +
                "<h5>Greeting From " +
                storedata[0].name +
                "</h5>" +
                "<h4> Your Order " +
                storedata[0].order_id +
                " status has been change to <b>" +
                storedata[0].status +
                "</b> </h4>" +
                "<p>Thank For Order to us</p>" +
                '</div><div style="display: list-item;">' +
                "<p>Best from :</p>" +
                '<span style="margin-bottom:0">' +
                storedata[0].mobile_number +
                "</span><br>" +
                '<span style="margin-bottom:0">' +
                storedata[0].store_email +
                "</span><br>" +
                '<span style="margin-bottom:0">' +
                storedata[0].city +
                "</span><br>" +
                "</div></body></html>",
            };

            transporter.sendMail(mailDetails, function (err, data) {
              if (err) {
                console.log(err);
                console.log("Error Occurs");
                req.flash("error", "Message not occurred!");
              } else {
                console.log(data);

                console.log("Email sent successfully");
                req.flash("success", "Email Send Successful");
              }
            });
          }
        }
      }

      let date = new Date();
      let day = (date.getDate() < 10 ? "0" : "") + date.getDate();
      let month = (date.getMonth() + 1 < 10 ? "0" : "") + (date.getMonth() + 1);
      let year = date.getFullYear();
      let fullDate = `${year}-${month}-${day}`;

      // await DataFind(
      //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${storedata[0].order_id}', '${fullDate}', '${accessdata.topbardata.id}', '${storedata[0].store_id}', 'The order status ${storedata[0].order_id} has been updated, please check it.')`
      // );
      // await DataFind(
      //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${storedata[0].order_id}', '${fullDate}', '${accessdata.topbardata.id}', '${order_date[0].customer_id}', 'The order status '${storedata[0].order_id}' has been updated, please check it.')`
      // );

      const storeNotification = await DataInsert(
        `tbl_notification`,
        `invoice, date, sender, received, notification`,
        `'${storedata[0].order_id}', '${fullDate}', '${accessdata.topbardata.id}', '${storedata[0].store_id}', 
    'The order status ${storedata[0].order_id} has been updated, please check it.'`,
        req.hostname,
        req.protocol
      );

      if (storeNotification == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/some_error_page");
      }

      const customerNotification = await DataInsert(
        `tbl_notification`,
        `invoice, date, sender, received, notification`,
        `'${storedata[0].order_id}', '${fullDate}', '${accessdata.topbardata.id}', '${order_date[0].customer_id}', 
    'The order status ${storedata[0].order_id} has been updated, please check it.'`,
        req.hostname,
        req.protocol
      );

      if (customerNotification == -1) {
        req.flash("errors", process.env.dataerror);
        return res.redirect("/some_error_page");
      }

      // await DataFind(
      //   `INSERT INTO tbl_notification (invoice, date, sender, received, notification) VALUE ('${storedata[0].order_id}', '${fullDate}', '${accessdata.topbardata.id}', '1', 'The order status ${storedata[0].order_id} has been updated, please check it.')`
      // );

      if (customer_data[0].name != "Walk in customer") {
        // ========= sms ============ //

        let ACCOUNT_SID = accessdata.masterstore.twilio_sid;
        let AUTH_TOKEN = accessdata.masterstore.twilio_auth_token;

        if (ACCOUNT_SID && AUTH_TOKEN) {
          try {
            const client_sms = require("twilio")(ACCOUNT_SID, AUTH_TOKEN);

            client_sms.messages
              .create({
                body: `We have successfully change your order status.`,
                from: accessdata.masterstore.twilio_phone_no,
                to: customer_data[0].number,
              })
              .then((message) => console.log(message.sid))
              .catch((e) => {
                req.flash("error", "Message not occurred!");
              });
          } catch (error) {
            console.log(error);
          }
        }
      }

      if (accessdata.masterstore.onesignal_app_id) {
        let message = {
          app_id: accessdata.masterstore.onesignal_app_id,
          contents: {
            en: "The order status has been updated, please check it.",
          },
          headings: { en: "laundry" },
          included_segments: ["Subscribed Users"],
          filters: [
            {
              field: "tag",
              key: "subscription_user_Type",
              relation: "=",
              value: "master",
            },
            { operator: "AND" },
            { field: "tag", key: "Login_ID", relation: "=", value: "1" },
          ],
        };
        sendNotification(message);

        let store_message = {
          app_id: accessdata.masterstore.onesignal_app_id,
          contents: {
            en: "The order status has been updated, please check it.",
          },
          headings: { en: "laundry" },
          included_segments: ["Subscribed Users"],
          filters: [
            {
              field: "tag",
              key: "subscription_user_Type",
              relation: "=",
              value: accessdata.logas,
            },
            { operator: "AND" },
            {
              field: "tag",
              key: "Login_ID",
              relation: "=",
              value: accessdata.topbardata.id,
            },
          ],
        };
        sendNotification(store_message);
      }

      res
        .status(208)
        .json({ status: "success", messge: "Order status changed" });
    } else {
      return res
        .status(208)
        .json({ status: "error", messge: "your not authorized for this" });
    }
  } catch (error) {
    console.log(11111, error);
  }
});

router.post("/addpayment", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === 'true') {
      req.flash('error', 'For demo purpose we disabled crud operations!!');
      return res.redirect(req.get("Referrer") || "/");
    }
    const { paid, orderid, balan, payment } = req.body;
    const { id, loginas } = req.user;
    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);

    const orderdata = await DataFind(
      "SELECT * FROM tbl_order WHERE id=" + orderid + ""
    );

    if (!orderdata || orderdata.length === 0) {
      return res.status(404).json({ status: "error", message: "Order not found" });
    }

    if (isStaff && staffStoreId && orderdata[0].store_id != staffStoreId) {
      return res.status(403).json({ status: "error", message: "Unauthorized to add payment to orders from other stores" });
    }

    var ORD_id = await idfororder();
    const paidamount = parseFloat(paid);
    console.log("req.body", req.body);

    // const paymentdata =
    //   await DataFind(`INSERT INTO tbl_order_payment (payment_amount,payment_account,order_id) 
    //     VALUE (${paid},'${payment}','${orderid}')`);

    const paymentdata = await DataInsert(
      `tbl_order_payment`,
      `payment_amount, payment_account, order_id`,
      `${paid}, '${payment}', '${orderid}'`,
      req.hostname,
      req.protocol
    );

    if (paymentdata == -1) {
      req.flash('error', process.env.dataerror);
      return res.redirect("/some_error_page");
    }





    // const orderupdate = await DataFind(
    //   "UPDATE tbl_order SET payment_data=CONCAT(payment_data,'," +
    //     paymentdata.insertId +
    //     "','') , paid_amount = ROUND(paid_amount + " +
    //     paidamount +
    //     ",2), balance_amount = ROUND(gross_total - paid_amount,2) WHERE id=" +
    //     orderid +
    //     ""
    // );

    const orderupdate = await DataUpdate(`tbl_order`, `payment_data = CONCAT(payment_data, ',${paymentdata.insertId}', ''),
         paid_amount = ROUND(paid_amount + ${paidamount}, 2),
         balance_amount = ROUND(gross_total - paid_amount, 2)`,
      `id=${orderid}`, req.hostname, req.protocol);

    if (orderupdate == -1) {
      req.flash("error", "Failed to record payment, please check input and try again");
      return res.redirect("back");
    }



    // console.log("orderupdate" , orderupdate);
    const account = await DataFind(
      "SELECT * FROM tbl_account WHERE id=" +
      payment +
      "  AND delet_flage != '1' "
    );

    const balance = parseFloat(account[0].balance) + parseFloat(paid);

    // await DataFind(
    //   "UPDATE tbl_account SET balance=" +
    //     balance +
    //     " WHERE id=" +
    //     payment +
    //     "   AND delet_flage != '1' "
    // );


    const data = await DataUpdate(`tbl_account`, `balance=${balance}`,
      `id=${payment} AND delet_flage != '1'`, req.hostname, req.protocol);

    if (data == -1) {
      req.flash("error", "Failed to update account balance, please try again");
      return res.redirect("back");
    }

    // await DataFind(`INSERT into tbl_transections (account_id,store_ID,transec_detail,transec_type,debit_amount,credit_amount,balance_amount, customer_id) 
    //             VALUE ('${payment}','${account[0].store_ID}','POS Income ${ORD_id}','INCOME', 0,${paidamount},${balance}, '${orderdata[0].customer_id}')`);





    if (await DataInsert(
      `tbl_transections`,
      `account_id,store_ID,transec_detail,transec_type,debit_amount,credit_amount,balance_amount, customer_id`,
      `'${payment}','${account[0].store_ID}','POS Income ${ORD_id}','INCOME', 0,${paidamount},${balance}, '${orderdata[0].customer_id}'`,
      req.hostname,
      req.protocol
    ) == -1) {
      req.flash('error', process.env.dataerror);
      return res.redirect("/some_error_page");
    }

    res.status(200).json({ status: "success", message: "Payment Data Saved" });
  } catch (error) {
    console.log(error);
  }
});

// open payment model for order list
router.get("/paymodel/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const orderid = req.params.id;

    const order = await DataFind(
      "SELECT tbl_order.*,tbl_orderstatus.status as status FROM tbl_order join tbl_orderstatus on tbl_order.order_status=tbl_orderstatus.id WHERE tbl_order.id=" +
      orderid +
      ""
    );

    if (!order || order.length === 0) {
      return res.status(404).json({ status: "error", message: "Order not found" });
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    if (isStaff && staffStoreId && order[0].store_id != staffStoreId) {
      return res.status(403).json({ status: "error", message: "Unauthorized to access orders from other stores" });
    }

    const customer = await DataFind(
      "SELECT * FROM tbl_customer WHERE id=" + order[0].customer_id + ""
    );
    const account = await DataFind(
      "SELECT * FROM tbl_account WHERE store_ID=" +
      order[0].store_id +
      "  AND delet_flage != '1' "
    );

    res.status(200).json({ order: order[0], customer: customer[0], account });
  } catch (error) {
    console.log(error);
  }
});

router.get("/barcode/:id", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    const order_date = await DataFind(
      `SELECT * FROM tbl_order WHERE id = '${req.params.id}'`
    );
    // console.log(order_date);

    const service_list = order_date[0].service_list.split(",");
    console.log(service_list);

    const service_list_data = await DataFind(
      `SELECT * FROM tbl_cart_servicelist`
    );
    // console.log(service_list_data);
    res.json({ service_list, service_list_data, order_date, accessdata });
  } catch (error) {
    console.log(error);
  }
});

const renderOrderPrint = async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    var orderid = (req.body && req.body.orderid) || req.query.orderid || req.params.id;
    var { deliverydate, extradiscount, paid_amount, note } = req.body || {};

    paid_amount = paid_amount ? Number(paid_amount) : 0;
    extradiscount = extradiscount ? Number(extradiscount) : 0;

    if (!orderid) {
      req.flash("errors", "Order ID is required");
      return res.redirect("/order/list");
    }

    const orderdata = await DataFind(`
      SELECT 
        o.*, 
        s.status AS order_status_name
      FROM 
        tbl_order o
      LEFT JOIN 
        tbl_orderstatus s 
      ON 
        o.order_status = s.id
      WHERE 
        o.order_id = '${orderid}' OR o.id = '${orderid}'
    `);

    if (!orderdata || orderdata.length === 0) {
      req.flash("errors", "Order not found");
      return res.redirect("/order/list");
    }

    const { isStaff, staffStoreId } = await getStaffScope(id, loginas);
    if (isStaff && staffStoreId && orderdata[0].store_id != staffStoreId) {
      req.flash("errors", "You are not authorized to view orders from other stores");
      return res.redirect("/order/list");
    }

    var shope = await DataFind(
      "SELECT * FROM tbl_store WHERE id=" + orderdata[0].store_id + ""
    );

    let addonslist = [];
    if (orderdata[0].addon_data) {
      const addon = orderdata[0].addon_data.toString().split(",");
      if (addon[0] && addon[0] != "0") {
        addonslist = await Promise.all(
          addon.filter(Boolean).map(async (data) => {
            var addondata = await DataFind(
              "SELECT * FROM tbl_addons WHERE id=" + data + ""
            );
            return addondata && addondata.length > 0
              ? {
                id: addondata[0].id,
                name: addondata[0].addon,
                price: addondata[0].price,
              }
              : null;
          })
        );
        addonslist = addonslist.filter(Boolean);
      }
    }

    let orderServiceList = [];
    if (orderdata[0].service_list) {
      orderServiceList = await DataFind(
        "SELECT * from tbl_cart_servicelist WHERE find_in_set(tbl_cart_servicelist.id,'" +
        orderdata[0].service_list +
        "')"
      );
    }

    const customer = await DataFind(
      "SELECT * FROM tbl_customer WHERE id=" + orderdata[0].customer_id + ""
    );

    let oate = new Date(orderdata[0].order_date).toLocaleDateString("en-CA");
    let ddate = new Date(orderdata[0].delivery_date).toLocaleDateString("en-CA");

    res.render("orderprint", {
      cartservice: orderServiceList,
      shope: shope && shope.length > 0 ? shope[0] : {},
      order: orderdata[0],
      addonslist,
      customer: customer && customer.length > 0 ? customer : [{ name: "Walk in customer" }],
      master: accessdata.masterstore,
      oate,
      ddate,
      accessdata,
    });
  } catch (error) {
    console.error("Error in renderOrderPrint:", error);
    res.redirect("/order/list");
  }
};

router.post("/orderprint", auth, renderOrderPrint);
router.get("/orderprint", auth, renderOrderPrint);
router.get("/orderprint/:id", auth, renderOrderPrint);

const handleListStatus = async (req, res) => {
  try {
    const accessdata = await access(req.user);
    const status = req.params.status || req.query.status || "";
    const search = req.query.search || "";
    const built = await buildOrderListQuery(req.user, status, search, 10, 0);
    if (!built.authorized) {
      return res.status(403).send({ error: "Unauthorized", orderlist: [] });
    }

    const orderlist = await DataFind(built.query);
    res.send({
      orderlist,
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
      login: built.login,
      isStaff: built.isStaff,
    });
  } catch (error) {
    console.error("/order/liststattus error:", error);
    res.status(500).send({ error: error.message, orderlist: [] });
  }
};

router.get("/liststattus/:status", auth, handleListStatus);
router.get("/liststattus", auth, handleListStatus);

module.exports = router;
