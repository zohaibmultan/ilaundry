const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
const bcrypt = require('bcrypt')
var {DataDelete,DataUpdate,DataInsert,DataFind} = require("../middelwer/databaseQurey")

const { paginateDataTable } = require("../middelwer/dataTableHelper");

router.get("/list", auth, async (req, res) => {
  const { id, roll, store, loginas } = req.user;
  const accessdata = await access(req.user);

  const storeList = await DataFind(
    "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0"
  );
  const multiy = await DataFind(
    "SELECT type , customer_selection FROM tbl_master_shop"
  );
  if (multiy[0].type == 1 && multiy[0].customer_selection == 1) {
    var ismulty = true;
  } else {
    var ismulty = false;
  }

  const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
  const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
  const staffStoreId = isStaff ? adminData[0].store_ID : null;
  let staffStoreName = "";
  if (staffStoreId) {
    const sName = await DataFind(`SELECT name FROM tbl_store WHERE id = '${staffStoreId}'`);
    if (sName.length > 0) staffStoreName = sName[0].name;
  }

  let login = "store";
  if (loginas == 0) {
    login = "customer";
  } else {
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (isStaff && staffStoreId) {
      login = (rolldetail.length > 0 && rolldetail[0].rollType === "master") ? "master" : "store";
    } else if (rolldetail.length > 0 && rolldetail[0].rollType === "master") {
      login = "master";
    }
  }

  const isStoreUser = adminData.length > 0 && adminData[0].store_ID && String(adminData[0].store_ID).trim() !== "" && String(adminData[0].store_ID).trim() !== "0";
  let assignedStoreId = "";
  if (isStaff && staffStoreId) {
    assignedStoreId = staffStoreId;
  } else if (isStoreUser) {
    assignedStoreId = adminData[0].store_ID;
  } else if (store && String(store).trim() !== "" && String(store).trim() !== "0") {
    assignedStoreId = store;
  } else if (storeList && storeList.length > 0) {
    assignedStoreId = storeList[0].id;
  }

  res.render("coustomer", {
    coustormdata: [],
    login,
    ismulty,
    storeList,
    accessdata,
    is_staff: isStaff,
    staff_store_id: staffStoreId,
    staff_store_name: staffStoreName,
    assigned_store_id: assignedStoreId,
    language: req.language_data,
    language_name: req.language_name,
  });
});

router.get("/list/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    const multiy = await DataFind("SELECT type, customer_selection FROM tbl_master_shop");
    const ismulty = multiy && multiy.length > 0 && multiy[0].type == 1 && multiy[0].customer_selection == 0;

    const adminData = await DataFind(`SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`);
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const staffStoreId = isStaff ? adminData[0].store_ID : null;

    let login = "store";
    let scopeConditions = [
      "tbl_customer.delet_flage = 0",
      "tbl_customer.name != 'Walk in customer'",
      "(tbl_customer.username != '' OR tbl_customer.number != '' OR tbl_customer.email != '')"
    ];

    if (loginas == 0) {
      login = "customer";
      scopeConditions.push(`tbl_customer.store_ID = '${store}'`);
      scopeConditions.push(`tbl_customer.id = ${id}`);
    } else {
      const rolldetail = await DataFind(`
        SELECT sr.*, r.roll_status, r.rollType 
        FROM tbl_staff_roll sr
        JOIN tbl_roll r ON sr.main_roll_id = r.id
        WHERE sr.id = ${roll}
      `);

      if (isStaff && staffStoreId) {
        login = (rolldetail.length > 0 && rolldetail[0].rollType === "master") ? "master" : "store";
        scopeConditions.push(`tbl_customer.store_ID = '${staffStoreId}'`);
      } else if (
        rolldetail &&
        rolldetail.length > 0 &&
        rolldetail[0].rollType === "master" &&
        rolldetail[0].customers &&
        rolldetail[0].customers.includes("read")
      ) {
        login = "master";
      } else if (
        rolldetail &&
        rolldetail.length > 0 &&
        rolldetail[0].rollType === "store" &&
        rolldetail[0].customers &&
        rolldetail[0].customers.includes("read")
      ) {
        login = "store";
        scopeConditions.push(`tbl_customer.store_ID = '${store}'`);
      } else {
        return res.status(403).json({ draw: parseInt(req.query.draw) || 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
      }
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.approved;
    if (statusParam !== undefined && statusParam !== null && !["all", "ALL", ""].includes(String(statusParam).trim())) {
      const cleanApproved = String(statusParam).trim() === "1" ? "1" : "0";
      filterConditions.push(`tbl_customer.approved = ${cleanApproved}`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (storeParam && login === "master" && !["all", "ALL", "", "0"].includes(String(storeParam).trim())) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_customer.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      (accessdata && accessdata.logas === 'custmor' && accessdata.roll && accessdata.roll.customer && accessdata.roll.customer.includes('edit')) ||
      (accessdata && accessdata.roll && accessdata.roll.customers && accessdata.roll.customers.includes('edit'))
    );
    const canDelete = Boolean(
      accessdata && accessdata.roll && accessdata.roll.customers && accessdata.roll.customers.includes('delete')
    );

    const result = await paginateDataTable(req, {
      select: `tbl_customer.*, 
               COALESCE(tbl_store.name, '') AS store,
               (
                 SELECT COUNT(*) 
                 FROM tbl_transections 
                 WHERE tbl_transections.customer_id = tbl_customer.id
               ) AS transiction`,
      from: `tbl_customer LEFT JOIN tbl_store ON tbl_customer.store_ID = tbl_store.id`,
      searchColumns: [
        'tbl_customer.name',
        'tbl_customer.number',
        'tbl_customer.email',
        'tbl_customer.address',
        'tbl_customer.taxnumber',
        'tbl_store.name'
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: 'tbl_customer.id DESC',
      columnMap: {
        0: 'tbl_customer.id',
        1: 'tbl_customer.name',
        2: 'tbl_customer.number',
        3: 'tbl_customer.address',
        4: 'tbl_store.name',
        5: 'tbl_customer.approved'
      },
      postProcess: async (rows) => {
        return rows.map((cust) => ({
          id: cust.id,
          name: cust.name || '',
          number: cust.number || '',
          email: cust.email || '',
          address: cust.address || '',
          store: cust.store || '',
          taxnumber: cust.taxnumber || '',
          roll_id: cust.roll_id || '',
          approved: cust.approved === 1 ? 1 : 0,
          delet_flage: cust.delet_flage,
          transiction: parseInt(cust.transiction) || 0,
          canEdit,
          canDelete,
          login
        }));
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Customer list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
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
        req.flash("error", "Failed to update customer, please check input and try again");
        return res.redirect("back");
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
      const verfiyStore = await DataFind(`SELECT * FROM tbl_admin WHERE id=${id}`);
      const isStaff = verfiyStore.length > 0 && verfiyStore[0].is_staff != 0;
      const isStoreUser = verfiyStore.length > 0 && verfiyStore[0].store_ID && String(verfiyStore[0].store_ID).trim() !== "" && String(verfiyStore[0].store_ID).trim() !== "0";

      let storeid = req.body.storeid;
      if (isStaff || isStoreUser) {
        // Staff member or Store User can ONLY create customers for their assigned store
        storeid = verfiyStore[0].store_ID;
      }

      if (!storeid || storeid.toString().trim() === "" || storeid === "0") {
        if (store && String(store).trim() !== "" && String(store).trim() !== "0") {
          storeid = store;
        } else {
          const firstStore = await DataFind("SELECT id FROM tbl_store WHERE status=1 AND delete_flage=0 LIMIT 1");
          if (firstStore.length > 0) storeid = firstStore[0].id;
        }
      }

      if (!storeid || storeid.toString().trim() === "" || storeid === "0") {
        req.flash("error", "No active store found to assign this customer!");
        return res.redirect(req.get("Referrer") || "/");
      }
          
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
      const data = await DataInsert(
        `tbl_customer`,
        `name,number,email,address,taxnumber,username,password,store_ID,reffstore,main_roll_id,approved`,
        `'${name}','${number}','${email}','${address}','${taxnumber}','${username}','${hashpass}','${storeid}','${storeid}',${main_roll[0].id},1`,
        req.hostname,
        req.protocol
      );

if (data == -1) {
  req.flash('error', "Failed to save customer, please check input and try again");
  return res.redirect("back");
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

    const customerData = await DataFind(`SELECT * FROM tbl_customer WHERE id = '${req.params.id}'`);
    const customer = (customerData && customerData.length > 0) ? customerData[0] : null;

    res.render("customer_ledger", {
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
      transection_list: [],
      customer,
    });
  } catch (error) {
    console.log(error);
  }
});

router.get("/ledger/:id/data", auth, async (req, res) => {
  try {
    const customerId = req.params.id;
    const filterConditions = [];

    const typeParam = req.query.type_filter || req.query.transec_type;
    if (typeParam && !["all", "ALL", ""].includes(String(typeParam).trim())) {
      const cleanType = String(typeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_transections.transec_type = '${cleanType}'`);
    }

    if (req.query.start_date) {
      const cleanStartDate = String(req.query.start_date).trim().replace(/'/g, "\\'");
      filterConditions.push(`DATE(tbl_transections.date) >= '${cleanStartDate}'`);
    }
    if (req.query.end_date) {
      const cleanEndDate = String(req.query.end_date).trim().replace(/'/g, "\\'");
      filterConditions.push(`DATE(tbl_transections.date) <= '${cleanEndDate}'`);
    }

    const result = await paginateDataTable(req, {
      select: `tbl_transections.*, COALESCE(tbl_account.ac_name, "") AS ac_name`,
      from: `tbl_transections LEFT JOIN tbl_account ON tbl_transections.account_id = tbl_account.id`,
      searchColumns: [
        'tbl_account.ac_name',
        'tbl_transections.transec_type',
        'tbl_transections.transec_detail',
        'tbl_transections.debit_amount',
        'tbl_transections.credit_amount'
      ],
      baseWhere: [`tbl_transections.customer_id = '${customerId}'`],
      filterWhere: filterConditions,
      defaultOrder: 'tbl_transections.id DESC',
      columnMap: {
        0: 'tbl_transections.id',
        1: 'tbl_transections.date',
        2: 'tbl_account.ac_name',
        3: 'tbl_transections.transec_type',
        4: 'tbl_transections.transec_detail',
        5: 'tbl_transections.debit_amount',
        6: 'tbl_transections.credit_amount'
      },
      postProcess: async (rows) => {
        return rows.map((row) => {
          let dateStr = '';
          if (row.date) {
            const d = new Date(row.date);
            const day = (d.getDate() < 10 ? '0' : '') + d.getDate();
            const month = ((d.getMonth() + 1) < 10 ? '0' : '') + (d.getMonth() + 1);
            dateStr = `${d.getFullYear()}/${month}/${day}`;
          }
          return {
            id: row.id,
            date: dateStr,
            ac_name: row.ac_name || '',
            transec_type: row.transec_type || '',
            transec_detail: row.transec_detail || '',
            debit_amount: row.debit_amount || 0,
            credit_amount: row.credit_amount || 0
          };
        });
      }
    });

    return res.json(result);
  } catch (error) {
    console.error("Customer ledger data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
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
        req.flash("error", "Failed to delete customer, please try again");
        return res.redirect("back");
      }

  req.flash("success", "Customer Deleted Successfully");
  res.redirect("/coustomer/list");
});

module.exports = router;
