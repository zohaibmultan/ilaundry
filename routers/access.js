const express = require("express");
const jwt = require("jsonwebtoken");
const bcrypt = require('bcrypt')
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind
} = require("../middelwer/databaseQurey");
const access = async (user) => {
  try {
    const { id, roll, store, loginas } = user;

let staff_roll = await DataFind(`
  SELECT sr.*, r.rollType
  FROM tbl_staff_roll sr
  JOIN tbl_roll r ON sr.main_roll_id = r.id
  WHERE sr.id = ${roll}
`);
let rolldetail = {}
if(staff_roll.length>0){
console.log("staff_roll",staff_roll);

let main_roll = await DataFind(`SELECT * FROM tbl_roll WHERE id = '${staff_roll[0].main_roll_id}'`);

const verifyData = [
  "orders", "expense", "service", "reports", "tools", "mail", "master",
  "sms", "staff", "pos", "customer", "customers", "master_setting", "branch_n_store",
  "Pay_Out", "account", "coupon", "rollaccess"
];

  
const dataroll = staff_roll[0];

 rolldetail = {
  
  id: staff_roll[0].id,
  main_roll_id: staff_roll[0].main_roll_id,
  staff_id: staff_roll[0].staff_id,
  is_staff: staff_roll[0].is_staff,
  rollType: staff_roll[0].rollType,
 
 
};

verifyData.forEach((key) => {
  
  const keyInMain = main_roll[0].hasOwnProperty(key)
    ? key
    : key === "customers" && main_roll[0].hasOwnProperty("customer")
    ? "customer"
    : key === "customer" && main_roll[0].hasOwnProperty("customers")
    ? "customers"
    : key;  

  const userPermissions = (dataroll[key] || "").split(",").map(p => p.trim()).filter(Boolean);
  const masterPermissions = (main_roll[0][keyInMain] || "").split(",").map(p => p.trim()).filter(Boolean);
  const finalPermissions = userPermissions.filter(p => masterPermissions.includes(p));

  rolldetail[key] = finalPermissions.join(",");
});
 
}
console.log(rolldetail);

    if (loginas == 0) {
      var logas = "custmor";
      var mutibranch = false;

      var topbardata = await DataFind(`
        SELECT 
        tbl_customer.id,
        tbl_customer.name,
        tbl_customer.number,
        tbl_customer.email,
        tbl_customer.address,
        tbl_customer.taxnumber,
        tbl_customer.username,
        tbl_customer.password,
        tbl_customer.store_ID,
        tbl_customer.reffstore,
        tbl_customer.approved,
        tbl_customer.main_roll_id,
        tbl_customer.delet_flage,
        IFNULL(tbl_store.name, '') AS store
        FROM tbl_customer 
        LEFT JOIN tbl_store ON tbl_customer.store_ID = tbl_store.id
        WHERE tbl_customer.id = "${id}"
`);
      console.log("if topbardata", topbardata);

     
      
      let staff_roll = await DataFind(`SELECT * FROM  tbl_roll  WHERE id = ${topbardata[0].main_roll_id} AND roll_status = 'active'`);
        rolldetail = staff_roll[0]
        console.log("rolldetail222",rolldetail);
        
      

      var isstore = false;
    } else {
      var topbardata = await DataFind(
        `SELECT tbl_admin.id,tbl_admin.name,tbl_admin.number,tbl_admin.email,tbl_admin.username,tbl_admin.password,tbl_admin.store_ID,tbl_admin.roll_id,tbl_admin.approved,tbl_admin.delet_flage,tbl_admin.img,tbl_admin.is_staff FROM tbl_admin WHERE  tbl_admin.id = "${id}"`
      );

      console.log("else topbardata", topbardata);

     

      if (topbardata[0].is_staff == 0) {
        var isstore = true;

       
        
      } else {
        var isstore = false;
      }
      if (rolldetail.rollType === "master") {
        const multiy = await DataFind("SELECT type FROM tbl_master_shop");
        // console.log("multiy" , multiy);
        if (multiy[0].type == 1) {
          var logas = "master";
          var mutibranch = true;
        } else {
          var logas = "master";
          var mutibranch = false;
        }
      } else {
        var logas = "store";
        var mutibranch = false;
      }
    }

    const masterstore = await DataFind(
      "SELECT * FROM tbl_master_shop where id=1"
    );
    const symbol =  masterstore[0].currency_symbol;
    const plac = masterstore[0].currency_placement;
    const thousands_separator = masterstore[0].thousands_separator;

    let notification_data = []
    if(mutibranch === true && logas == 'master'){
      notification_data = await DataFind(
      `SELECT * FROM tbl_notification ORDER BY id DESC LIMIT 5`
    );
    }else if((mutibranch === false && logas == 'master') || (logas== 'store')){
    notification_data = await DataFind(
      `SELECT * FROM tbl_notification WHERE received = '${topbardata[0].store_ID}' ORDER BY id DESC LIMIT 5`
    );
    }else{
      notification_data = await DataFind(
      `SELECT * FROM tbl_notification WHERE received = '${topbardata[0].id}' ORDER BY id DESC LIMIT 5`
    );
    }
    
console.log("notification_data",notification_data);
// console.log("topbardata[0].id",topbardata[0].id);

    return {
      logas,
      mutibranch,
      roll: rolldetail,
      topbardata: topbardata[0],
      isstore,
      symbol,
      plac,
      thousands_separator,
      masterstore: masterstore[0],
      notification_data,
    };
  }catch(error){
    console.log(error);
  }
};

module.exports = access;
