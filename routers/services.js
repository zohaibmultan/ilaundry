const express = require("express");
const router = express.Router();
const auth = require("../middelwer/auth");
const { upload, file_upload } = require("../middelwer/multer");
const access = require("../middelwer/access");
var Excel = require("exceljs");
const fs = require("fs");
const { parse } = require("fast-csv");
const path = require("path");
const csvParser = require("csv-parser");
var {
  DataDelete,
  DataUpdate,
  DataInsert,
  DataFind,
} = require("../middelwer/databaseQurey");
var mysql = require("mysql2");
const { paginateDataTable } = require("../middelwer/dataTableHelper");

function normalizeParallelTiers(seqs, types, prices, items, readyTimes) {
  const toArr = (v) => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
  const arrSeq = toArr(seqs);
  const arrType = toArr(types);
  const arrPrice = toArr(prices);
  const arrItems = toArr(items);
  const arrReady = toArr(readyTimes);

  const length = Math.max(arrSeq.length, arrType.length, arrPrice.length, arrItems.length, arrReady.length);
  const tiers = [];

  for (let i = 0; i < length; i++) {
    const typeId = arrType[i] ? String(arrType[i]).trim() : "";
    if (!typeId) continue;
    tiers.push({
      seq: parseInt(arrSeq[i]) || (i + 1),
      type: typeId,
      price: arrPrice[i] !== undefined && String(arrPrice[i]).trim() !== "" ? String(arrPrice[i]).trim() : "0",
      items: parseInt(arrItems[i]) || 1,
      ready_time: parseInt(arrReady[i]) || 1440,
    });
  }

  // Sort tiers by sequence number ASC
  tiers.sort((a, b) => a.seq - b.seq);

  return {
    services_type_sequence: tiers.map((t) => t.seq).join(","),
    services_type_id: tiers.map((t) => t.type).join(","),
    services_type_price: tiers.map((t) => t.price).join(","),
    services_type_items: tiers.map((t) => t.items).join(","),
    services_type_ready_time: tiers.map((t) => t.ready_time).join(","),
  };
}

// <<<<<<<<<<<<<<<<<<<SERVICE LIST ALL CRUD ROUTER>>>>>>>>>>>>>>>>>>>>>>

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
    let storeList = [];
    let categoryList = [];
    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      var ismulty = multiy[0].type == 1;
      if (ismulty) {
        storeList = await DataFind(
          "SELECT id, name FROM tbl_store WHERE status=1 AND delete_flage=0",
        );
      }
      categoryList = await DataFind(
        "SELECT id, name FROM tbl_service_category WHERE delete_flage=0 AND status='0' ORDER BY sequence_no ASC, name ASC",
      );

      res.render("service", {
        servicesdata: [],
        ismulty,
        storeList,
        categoryList,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service.includes("read")
    ) {
      categoryList = await DataFind(
        `SELECT id, name FROM tbl_service_category WHERE (store_ID='${store}' OR store_ID='1') AND delete_flage=0 AND status='0' ORDER BY sequence_no ASC, name ASC`,
      );

      res.render("service", {
        servicesdata: [],
        ismulty: false,
        storeList: [],
        categoryList,
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

router.get("/list/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    let scopeConditions = [];
    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      scopeConditions.push(`tbl_services.store_ID = '${store}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_services.status = '${cleanStatus}'`);
    }

    const categoryParam = req.query.category_filter;
    if (
      categoryParam !== undefined &&
      categoryParam !== null &&
      !["all", "ALL", "", "0"].includes(String(categoryParam).trim())
    ) {
      const cleanCat = parseInt(categoryParam) || 0;
      if (cleanCat > 0) filterConditions.push(`tbl_services.category_id = ${cleanCat}`);
    }

    const subcategoryParam = req.query.subcategory_filter;
    if (
      subcategoryParam !== undefined &&
      subcategoryParam !== null &&
      !["all", "ALL", "", "0"].includes(String(subcategoryParam).trim())
    ) {
      const cleanSubcat = parseInt(subcategoryParam) || 0;
      if (cleanSubcat > 0) filterConditions.push(`tbl_services.subcategory_id = ${cleanSubcat}`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_services.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_services.*, 
               COALESCE(tbl_store.name, '') as store, 
               COALESCE(tbl_service_category.name, 'Uncategorized') as category_name,
               COALESCE(tbl_service_subcategory.name, '—') as subcategory_name,
               (SELECT GROUP_CONCAT(tbl_services_type.services_type) FROM tbl_services_type WHERE FIND_IN_SET(tbl_services_type.id, tbl_services.services_type_id)) as serviceType`,
      from: `tbl_services 
             LEFT JOIN tbl_store ON tbl_services.store_ID = tbl_store.id
             LEFT JOIN tbl_service_category ON tbl_services.category_id = tbl_service_category.id
             LEFT JOIN tbl_service_subcategory ON tbl_services.subcategory_id = tbl_service_subcategory.id`,
      searchColumns: ["tbl_services.name", "tbl_store.name", "tbl_service_category.name", "tbl_service_subcategory.name"],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_services.sequence_no ASC, tbl_services.id ASC",
      columnMap: {
        0: "tbl_services.id",
        1: "tbl_services.sequence_no",
        2: "tbl_services.name",
        3: "tbl_service_category.name",
        4: "tbl_services.no_of_items",
        5: "tbl_services.id",
        6: isMaster ? "tbl_store.name" : "tbl_services.status",
        7: "tbl_services.status",
      },
      postProcess: async (rows) => {
        return rows.map((s) => ({
          id: s.id,
          sequence_no: s.sequence_no !== undefined ? s.sequence_no : 0,
          name: s.name || "",
          category_name: s.category_name || "Uncategorized",
          subcategory_name: s.subcategory_name || "—",
          no_of_items: parseInt(s.no_of_items) > 0 ? parseInt(s.no_of_items) : 1,
          image: s.image || "",
          serviceType: s.serviceType || "",
          store: s.store || "",
          status: parseInt(s.status) || 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Services list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.get("/addservice", auth, async (req, res) => {
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

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const isStoreUser =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID).trim() !== "" &&
      String(adminData[0].store_ID).trim() !== "0";
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";
    const isMaster =
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0].store_ID || adminData[0].store_ID == 0);

    let ismulty = false;
    let storeList = [];

    if (isMaster && rolldetail[0].service.includes("write")) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");

      if (multiy[0].type == 1) {
        ismulty = true;
        storeList = await DataFind(
          "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
        );
      }
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service.includes("write")
    ) {
      ismulty = false;
      storeList = [];
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const defaultStoreId = ismulty
      ? (storeList.length > 0 ? storeList[0].id : (assignedStore || "1"))
      : (assignedStore || "1");

    const categories = await DataFind(`
      SELECT id, name FROM tbl_service_category 
      WHERE (store_ID = '${defaultStoreId}' OR store_ID = '1') AND delete_flage = '0' AND status = '0' 
      ORDER BY sequence_no ASC, name ASC
    `);

    res.render("add_service", {
      ismulty,
      storeList,
      categories,
      accessdata,
      assigned_store_id: assignedStore,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
  }
});

router.post("/addservice", auth, upload.single("image"), async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { id, roll, store } = req.user;
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
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service.includes("write")
    ) {
      var img = req.file ? req.file.filename : "";

      var {
        name,
        category_id,
        subcategory_id,
        sequence_no,
        no_of_items,
        service_type_seq,
        service_type,
        service_price,
        service_type_items,
        service_type_ready_time,
        active,
        storeid,
      } = req.body;

      const cleanCatId = parseInt(category_id) || 0;
      if (cleanCatId <= 0) {
        req.flash("error", "Category is required!");
        return res.redirect(req.get("Referrer") || "/services/addservice");
      }
      const cleanSubcatId = parseInt(subcategory_id) || null;
      const subcatSql = cleanSubcatId ? cleanSubcatId : "NULL";

      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
      );
      const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
      const isStoreUser =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID).trim() !== "" &&
        String(adminData[0].store_ID).trim() !== "0";
      const assignedStore =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID) !== "0"
          ? String(adminData[0].store_ID)
          : store
            ? String(store)
            : "";
      const isMaster =
        rolldetail[0].rollType === "master" &&
        !isStaff &&
        (!adminData[0].store_ID || adminData[0].store_ID == 0);

      // A store default user or staff can ONLY add services to their assigned store
      if (!isMaster || isStaff || isStoreUser) {
        storeid = assignedStore;
      }

      if (
        !storeid ||
        String(storeid).trim() === "" ||
        String(storeid).trim() === "0"
      ) {
        req.flash("error", "Please select a valid store for this service!");
        return res.redirect(req.get("Referrer") || "/services/list");
      }

      const normalized = normalizeParallelTiers(
        service_type_seq,
        service_type,
        service_price,
        service_type_items,
        service_type_ready_time,
      );
      active = active ? "0" : "1";
      const cleanNoOfItems = parseInt(no_of_items) > 0 ? parseInt(no_of_items) : 1;

      // Automatically assign the next sequence number (last number in store)
      const maxRow = await DataFind(
        `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_services WHERE store_ID = '${storeid}'`,
      );
      const cleanSeqNo = (maxRow && maxRow[0] && Number(maxRow[0].max_seq) + 1) || 1;

      const newservtype = await DataInsert(
        `tbl_services`,
        `name,image,sequence_no,sequance_no,no_of_items,services_type_sequence,services_type_id,services_type_price,services_type_items,services_type_ready_time,store_ID,status,category_id,subcategory_id`,
        `'${name}', '${img}', '${cleanSeqNo}', '${cleanSeqNo}', '${cleanNoOfItems}', '${normalized.services_type_sequence}', '${normalized.services_type_id}', '${normalized.services_type_price}', '${normalized.services_type_items}', '${normalized.services_type_ready_time}', '${storeid}', '${active}', ${cleanCatId}, ${subcatSql}`,
        req.hostname,
        req.protocol,
      );

      if (newservtype == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Service Added Successfully!");
      return res.redirect("/services/list");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.error("Error in /addservice:", error);
    req.flash("error", "An unexpected error occurred while adding service");
    return res.redirect("/services/list");
  }
});

router.get("/deletservices/:id", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service.includes("delete")
    ) {
      var dataid = req.params.id;

      const serviceCheck = await DataFind(
        `SELECT id, store_ID FROM tbl_services WHERE id = '${dataid}'`,
      );
      if (!serviceCheck || serviceCheck.length === 0) {
        req.flash("error", "Service not found!");
        return res.redirect(req.get("Referrer") || "/services/list");
      }

      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
      );
      const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
      const isStoreUser =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID).trim() !== "" &&
        String(adminData[0].store_ID).trim() !== "0";
      const assignedStore =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID) !== "0"
          ? String(adminData[0].store_ID)
          : store
            ? String(store)
            : "";
      const isMaster =
        rolldetail[0].rollType === "master" &&
        !isStaff &&
        (!adminData[0].store_ID || adminData[0].store_ID == 0);

      // Verify store ownership: store user or staff can ONLY delete services from their assigned store
      if (!isMaster || isStaff || isStoreUser) {
        if (String(serviceCheck[0].store_ID) !== String(assignedStore)) {
          req.flash(
            "error",
            "You are not authorized to delete services belonging to another store!",
          );
          return res.redirect(req.get("Referrer") || "/services/list");
        }
      }

      if (
        (await DataDelete(
          `tbl_services`,
          `id = '${dataid}'`,
          req.hostname,
          req.protocol,
        )) == -1
      ) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Services Deleted");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/updateService/:id", auth, async (req, res) => {
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
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service.includes("edit")
    ) {
      var dataid = req.params.id;
      const servicesdata = await DataFind(
        "SELECT * FROM tbl_services WHERE id=" + dataid + "",
      );
      if (!servicesdata || servicesdata.length === 0) {
        req.flash("error", "Service not found!");
        return res.redirect(req.get("Referrer") || "/services/list");
      }

      const adminData = await DataFind(
        `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
      );
      const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
      const isStoreUser =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID).trim() !== "" &&
        String(adminData[0].store_ID).trim() !== "0";
      const assignedStore =
        adminData.length > 0 &&
        adminData[0].store_ID &&
        String(adminData[0].store_ID) !== "0"
          ? String(adminData[0].store_ID)
          : store
            ? String(store)
            : "";
      const isMaster =
        rolldetail[0].rollType === "master" &&
        !isStaff &&
        (!adminData[0].store_ID || adminData[0].store_ID == 0);

      // Verify store ownership: store user or staff can ONLY edit services belonging to their assigned store
      if (!isMaster || isStaff || isStoreUser) {
        if (String(servicesdata[0].store_ID) !== String(assignedStore)) {
          req.flash(
            "error",
            "You are not authorized to edit services belonging to another store!",
          );
          return res.redirect(req.get("Referrer") || "/services/list");
        }
      }

      var servicestypedata = await DataFind(
        "SELECT * FROM tbl_services_type WHERE status=0 AND store_ID=" +
          servicesdata[0].store_ID +
          "",
      );

      const typeID = servicesdata[0].services_type_id
        ? servicesdata[0].services_type_id.split(",")
        : [];
      const price = servicesdata[0].services_type_price
        ? servicesdata[0].services_type_price.split(",")
        : [];
      const seqList = servicesdata[0].services_type_sequence
        ? servicesdata[0].services_type_sequence.split(",")
        : [];
      const itemsList = servicesdata[0].services_type_items
        ? servicesdata[0].services_type_items.split(",")
        : [];
      const readyList = servicesdata[0].services_type_ready_time
        ? servicesdata[0].services_type_ready_time.split(",")
        : [];

      const tiers = [];
      for (let i = 0; i < typeID.length; i++) {
        const tId = typeID[i] ? typeID[i].trim() : "";
        if (!tId) continue;
        tiers.push({
          id: tId,
          price: price[i] !== undefined && price[i].trim() !== "" ? price[i].trim() : "0",
          sequence: seqList[i] !== undefined && seqList[i].trim() !== "" ? parseInt(seqList[i]) : (i + 1),
          items: itemsList[i] !== undefined && itemsList[i].trim() !== "" ? parseInt(itemsList[i]) : 1,
          ready_time: readyList[i] !== undefined && readyList[i].trim() !== "" ? parseInt(readyList[i]) : 1440,
        });
      }
      tiers.sort((a, b) => a.sequence - b.sequence);

      const serviceStoreId = servicesdata[0].store_ID || "1";
      const categories = await DataFind(`
        SELECT id, name FROM tbl_service_category 
        WHERE (store_ID = '${serviceStoreId}' OR store_ID = '1') AND delete_flage = '0' AND status = '0' 
        ORDER BY sequence_no ASC, name ASC
      `);
      let subcategories = [];
      if (servicesdata[0].category_id) {
        subcategories = await DataFind(`
          SELECT id, name FROM tbl_service_subcategory 
          WHERE category_id = ${servicesdata[0].category_id} AND delete_flage = '0' AND status = '0' 
          ORDER BY sequence_no ASC, name ASC
        `);
      }

      res.render("edit_service", {
        services: servicesdata[0],
        categories,
        subcategories,
        typedata: servicestypedata,
        type: tiers.map((t) => t.id),
        price: tiers.map((t) => t.price),
        tiers: tiers,
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

router.post(
  "/updateservices/:id",
  auth,
  upload.single("image_update"),
  async (req, res) => {
    try {
      if (process.env.DISABLE_DB_WRITE === "true") {
        req.flash("error", "For demo purpose we disabled crud operations!!");
        return res.redirect(req.get("Referrer") || "/");
      }
      const { id, roll, store } = req.user;
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
        rolldetail &&
        rolldetail.length > 0 &&
        rolldetail[0].service.includes("edit")
      ) {
        const serviceCheck = await DataFind(
          `SELECT id, store_ID FROM tbl_services WHERE id = '${req.params.id}'`,
        );
        if (!serviceCheck || serviceCheck.length === 0) {
          req.flash("error", "Service not found!");
          return res.redirect(req.get("Referrer") || "/services/list");
        }

        const adminData = await DataFind(
          `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
        );
        const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
        const isStoreUser =
          adminData.length > 0 &&
          adminData[0].store_ID &&
          String(adminData[0].store_ID).trim() !== "" &&
          String(adminData[0].store_ID).trim() !== "0";
        const assignedStore =
          adminData.length > 0 &&
          adminData[0].store_ID &&
          String(adminData[0].store_ID) !== "0"
            ? String(adminData[0].store_ID)
            : store
              ? String(store)
              : "";
        const isMaster =
          rolldetail[0].rollType === "master" &&
          !isStaff &&
          (!adminData[0].store_ID || adminData[0].store_ID == 0);

        // Verify store ownership: store user or staff can ONLY update services in their assigned store
        if (!isMaster || isStaff || isStoreUser) {
          if (String(serviceCheck[0].store_ID) !== String(assignedStore)) {
            req.flash(
              "error",
              "You are not authorized to update services belonging to another store!",
            );
            return res.redirect(req.get("Referrer") || "/services/list");
          }
        }

        if (req.file) {
          var img = req.file.filename;

          const updateServiceImage = await DataUpdate(
            "tbl_services",
            `image = '${img}'`,
            `id = ${req.params.id}`,
            req.hostname,
            req.protocol,
          );

          if (updateServiceImage === -1) {
            req.flash(
              "error",
              "Action failed, please check input and try again",
            );
            return res.redirect("back");
          }
        }

        var {
          name_update,
          category_id_update,
          subcategory_id_update,
          sequence_no_update,
          no_of_items_update,
          service_type_seq,
          service_type,
          service_price,
          service_type_items,
          service_type_ready_time,
          active_update,
        } = req.body;

        const cleanCatId = parseInt(category_id_update || req.body.category_id) || 0;
        if (cleanCatId <= 0) {
          req.flash("error", "Category is required!");
          return res.redirect(req.get("Referrer") || `/services/updateService/${req.params.id}`);
        }
        const cleanSubcatId = parseInt(subcategory_id_update || req.body.subcategory_id) || null;
        const subcatSql = cleanSubcatId ? cleanSubcatId : "NULL";

        const normalized = normalizeParallelTiers(
          service_type_seq,
          service_type,
          service_price,
          service_type_items,
          service_type_ready_time,
        );
        active_update = active_update ? 0 : 1;
        const cleanSeqNo = parseInt(sequence_no_update) || 0;
        const cleanNoOfItems = parseInt(no_of_items_update) > 0 ? parseInt(no_of_items_update) : 1;

        const newservtype = await DataUpdate(
          "tbl_services",
          `name = '${name_update}', category_id = ${cleanCatId}, subcategory_id = ${subcatSql}, no_of_items = '${cleanNoOfItems}', services_type_sequence = '${normalized.services_type_sequence}', services_type_id = '${normalized.services_type_id}', services_type_price = '${normalized.services_type_price}', services_type_items = '${normalized.services_type_items}', services_type_ready_time = '${normalized.services_type_ready_time}', status = '${active_update}'`,
          `id = ${req.params.id}`,
          req.hostname,
          req.protocol,
        );

        if (newservtype === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        req.flash("success", "Services Updated");
        return res.redirect("/services/list");
      } else {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }
    } catch (error) {
      console.error("Error in /updateService/:id:", error);
      req.flash("error", "An error occurred while updating the service");
      return res.redirect("/services/list");
    }
  },
);

// >>>>>>>>>>>>SERVICES TYPE ALL CRUD ROUTER>>>>>>>>>>>>>>>>>>

router.get("/type", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
    );
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    if (multiy[0].type == 1) {
      var ismulty = true;
    } else {
      var ismulty = false;
    }

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
    // Compute next sequence number for new service type
    const seqRows = await DataFind(
      "SELECT store_ID, COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_services_type GROUP BY store_ID",
    );
    const nextSeqMap = {};
    if (seqRows && seqRows.length > 0) {
      seqRows.forEach((r) => {
        nextSeqMap[String(r.store_ID)] = Number(r.max_seq) + 1;
      });
    }
    const defaultStoreId = ismulty
      ? (storeList.length > 0 ? String(storeList[0].id) : "1")
      : (store ? String(store) : "1");
    const nextSequence = nextSeqMap[defaultStoreId] || 1;

    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service.includes("read")
    ) {
      res.render("service_type", {
        servicesTypeList: [],
        ismulty,
        storeList,
        accessdata,
        nextSequence,
        nextSeqMap,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service.includes("read")
    ) {
      res.render("service_type", {
        servicesTypeList: [],
        ismulty: false,
        storeList: [],
        accessdata,
        nextSequence: nextSeqMap[String(store)] || 1,
        nextSeqMap,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while loading service types");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/type/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    let scopeConditions = [];
    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      scopeConditions.push(`tbl_services_type.store_ID = '${store}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_services_type.status = '${cleanStatus}'`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_services_type.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_services_type.*, COALESCE(tbl_store.name, '') as store`,
      from: `tbl_services_type LEFT JOIN tbl_store ON tbl_services_type.store_ID = tbl_store.id`,
      searchColumns: [
        "tbl_services_type.services_type",
        "tbl_services_type.sequence_no",
        "tbl_services_type.id",
        "tbl_store.name",
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_services_type.sequence_no ASC, tbl_services_type.id DESC",
      columnMap: isMaster ? {
        0: "tbl_services_type.sequence_no",
        1: "tbl_services_type.sequence_no",
        2: "tbl_services_type.services_type",
        3: "tbl_services_type.id",
        4: "tbl_store.name",
        5: "tbl_services_type.status",
      } : {
        0: "tbl_services_type.sequence_no",
        1: "tbl_services_type.sequence_no",
        2: "tbl_services_type.services_type",
        3: "tbl_services_type.id",
        4: "tbl_services_type.status",
      },
      postProcess: async (rows) => {
        return rows.map((st) => ({
          id: st.id,
          sequence_no: parseInt(st.sequence_no) || 0,
          services_type: st.services_type || "",
          store: st.store || "",
          status: parseInt(st.status) || 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Service types list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addtype", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("write")) {
      var { service_name, active, storeid } = req.body;
      active ? (active = 0) : (active = 1);
      storeid ? storeid : (storeid = store);

      // Auto-assign next sequence number (last number in store)
      const maxRow = await DataFind(
        `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_services_type WHERE store_ID = '${storeid}'`,
      );
      const seqVal = (maxRow && maxRow[0] && Number(maxRow[0].max_seq) + 1) || 1;

      const newservtype = await DataInsert(
        `tbl_services_type`,
        `services_type,sequence_no,status,store_ID`,
        `${await mysql.escape(service_name)}, ${seqVal}, ${active}, ${storeid}`,
        req.hostname,
        req.protocol,
      );

      if (newservtype == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Services Type Added!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while adding service type");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/deletservicestype/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("delete")) {
      var dataid = req.params.id;
      // const newservtype = await DataFind(
      //   "DELETE FROM tbl_services_type WHERE id=" + dataid + ""
      // );

      if (
        (await DataDelete(
          `tbl_services_type`,
          `id = '${dataid}'`,
          req.hostname,
          req.protocol,
        )) == -1
      ) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Services Type Deleted");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updateservicestype/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("edit")) {
      var { service_name, active } = req.body;
      var dataid = req.params.id;
      active ? (active = 0) : (active = 1);

      const updateServiceType = await DataUpdate(
        "tbl_services_type",
        `services_type = ${await mysql.escape(service_name)}, status = ${active}`,
        `id = ${dataid}`,
        req.hostname,
        req.protocol,
      );

      if (updateServiceType === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Services Type Updated");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
    req.flash("error", "An error occurred while updating service type");
    return res.redirect("back");
  }
});

router.get("/typelist/:id", auth, async (req, res) => {
  try {
    const { id, roll, store } = req.user;
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
      rolldetail[0].service.includes("read")
    ) {
      const multiy = await DataFind("SELECT type FROM tbl_master_shop");
      if (multiy[0].type == 1) {
        var dataid = req.params.id;
        const servicestypedata = await DataFind(
          "SELECT * FROM tbl_services_type WHERE status=0 AND store_ID=" +
            dataid +
            " ",
        );
        return res.status(200).json({ data: servicestypedata });
      } else {
        var storeID = await DataFind(
          `SELECT * FROM tbl_admin WHERE  id= ${id}`,
        );

        const servicestypedata = await DataFind(
          `SELECT * FROM tbl_services_type WHERE status=0 AND store_ID=${storeID[0].store_ID}`,
        );
        return res.status(200).json({ data: servicestypedata });
      }
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service.includes("write")
    ) {
      const servicestypedata = await DataFind(
        "SELECT * FROM tbl_services_type WHERE status=0 AND store_ID=" +
          store +
          "",
      );
      res.status(200).json({ data: servicestypedata });
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

// <<<<<<<<<<<<<<<<<<<< SERVICES CATEGORIES CRUD ROUTERS >>>>>>>>>>>>>>>>>>>>

router.get("/category", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
    );
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    const ismulty = multiy && multiy.length > 0 && multiy[0].type == 1;

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("read")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "1";

    const seqRows = await DataFind(
      "SELECT store_ID, COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_service_category WHERE delete_flage = '0' GROUP BY store_ID",
    );
    const nextSeqMap = {};
    if (seqRows && seqRows.length > 0) {
      seqRows.forEach((r) => {
        nextSeqMap[String(r.store_ID)] = Number(r.max_seq) + 1;
      });
    }

    const defaultStoreId = ismulty
      ? (storeList.length > 0 ? String(storeList[0].id) : "1")
      : assignedStore;
    const nextSequence = nextSeqMap[defaultStoreId] || 1;

    return res.render("service_category", {
      ismulty: ismulty && rolldetail[0].rollType === "master" && !isStaff,
      storeList,
      accessdata,
      assigned_store_id: assignedStore,
      nextSequence,
      nextSeqMap,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("Error in /category:", error);
    req.flash("error", "An error occurred while loading categories");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/category/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";

    let scopeConditions = ["tbl_service_category.delete_flage = '0'"];
    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === "0") &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      scopeConditions.push(`tbl_service_category.store_ID = '${assignedStore}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_service_category.status = '${cleanStatus}'`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_service_category.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_service_category.*, COALESCE(tbl_store.name, '') as store_name`,
      from: `tbl_service_category LEFT JOIN tbl_store ON tbl_service_category.store_ID = tbl_store.id`,
      searchColumns: ["tbl_service_category.name", "tbl_store.name"],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_service_category.sequence_no ASC, tbl_service_category.id ASC",
      columnMap: {
        0: "tbl_service_category.id",
        1: "tbl_service_category.sequence_no",
        2: "tbl_service_category.name",
        3: isMaster ? "tbl_store.name" : "tbl_service_category.status",
        4: "tbl_service_category.status",
      },
      postProcess: async (rows) => {
        return rows.map((r) => ({
          id: r.id,
          sequence_no: r.sequence_no !== undefined ? r.sequence_no : 0,
          name: r.name || "",
          store_name: r.store_name || "",
          status: parseInt(r.status) || 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Category list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addcategory", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { id, roll, store } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("write")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    let { name, sequence_no, active, storeid } = req.body;
    active = active ? "0" : "1";
    
    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "1";
    const isMaster =
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === "0");

    if (!isMaster) {
      storeid = assignedStore;
    } else if (!storeid) {
      storeid = assignedStore || "1";
    }

    // Auto-assign next sequence number (last number in store)
    const maxRow = await DataFind(
      `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_service_category WHERE store_ID = '${storeid}' AND delete_flage = '0'`,
    );
    const seqVal = (maxRow && maxRow[0] && Number(maxRow[0].max_seq) + 1) || 1;

    const insertResult = await DataInsert(
      "tbl_service_category",
      "name, sequence_no, status, store_ID, delete_flage",
      `${mysql.escape(name)}, ${seqVal}, '${active}', '${storeid}', '0'`,
      req.hostname,
      req.protocol,
    );

    if (insertResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "New Service Category Added!");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /addcategory:", error);
    req.flash("error", "An error occurred while adding category");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/updatecategory/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { id, roll } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("edit")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const catId = req.params.id;
    let { name, active } = req.body;
    active = active ? "0" : "1";

    const updateResult = await DataUpdate(
      "tbl_service_category",
      `name = ${mysql.escape(name)}, status = '${active}'`,
      `id = ${catId}`,
      req.hostname,
      req.protocol,
    );

    if (updateResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "Category Updated Successfully!");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /updatecategory:", error);
    req.flash("error", "An error occurred while updating category");
    return res.redirect("back");
  }
});

router.get("/deletecategory/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { roll } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("delete")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const catId = req.params.id;

    // Check if any active services are assigned
    const activeServices = await DataFind(
      `SELECT id FROM tbl_services WHERE category_id = ${catId} LIMIT 1`,
    );
    if (activeServices && activeServices.length > 0) {
      req.flash("error", "Cannot delete category: active services are currently assigned to it. Reassign them first.");
      return res.redirect("back");
    }

    const deleteResult = await DataUpdate(
      "tbl_service_category",
      "delete_flage = '1'",
      `id = ${catId}`,
      req.hostname,
      req.protocol,
    );

    if (deleteResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    // Also soft-delete any associated subcategories
    await DataUpdate(
      "tbl_service_subcategory",
      "delete_flage = '1'",
      `category_id = ${catId}`,
      req.hostname,
      req.protocol,
    );

    req.flash("success", "Category Deleted Successfully");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /deletecategory:", error);
    req.flash("error", "An error occurred while deleting category");
    return res.redirect("back");
  }
});

// <<<<<<<<<<<<<<<<<<<< SERVICES SUB CATEGORIES CRUD ROUTERS >>>>>>>>>>>>>>>>>>>>

router.get("/subcategory", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
    );
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    const ismulty = multiy && multiy.length > 0 && multiy[0].type == 1;

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("read")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "1";

    const defaultStoreId = ismulty
      ? (storeList.length > 0 ? String(storeList[0].id) : "1")
      : assignedStore;

    // Load active categories for the default store
    const categoryList = await DataFind(`
      SELECT id, name, store_ID FROM tbl_service_category 
      WHERE delete_flage = '0' AND status = '0' AND store_ID = '${defaultStoreId}'
      ORDER BY sequence_no ASC, name ASC
    `);

    const maxRow = await DataFind(
      `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_service_subcategory WHERE store_ID = '${defaultStoreId}' AND delete_flage = '0'`,
    );
    const nextSequence = (maxRow && maxRow[0] && Number(maxRow[0].max_seq) + 1) || 1;

    return res.render("service_subcategory", {
      ismulty: ismulty && rolldetail[0].rollType === "master" && !isStaff,
      storeList,
      categoryList,
      accessdata,
      assigned_store_id: assignedStore,
      nextSequence,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.error("Error in /subcategory:", error);
    req.flash("error", "An error occurred while loading subcategories");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.get("/subcategory/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "";

    let scopeConditions = ["tbl_service_subcategory.delete_flage = '0'"];
    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === "0") &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      scopeConditions.push(`tbl_service_subcategory.store_ID = '${assignedStore}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_service_subcategory.status = '${cleanStatus}'`);
    }

    const catParam = req.query.category_filter;
    if (catParam && !["all", "ALL", "", "0"].includes(String(catParam).trim())) {
      const cleanCat = parseInt(catParam) || 0;
      if (cleanCat > 0) filterConditions.push(`tbl_service_subcategory.category_id = ${cleanCat}`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_service_subcategory.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_service_subcategory.*, COALESCE(tbl_service_category.name, 'Uncategorized') as category_name, COALESCE(tbl_store.name, '') as store_name`,
      from: `tbl_service_subcategory LEFT JOIN tbl_service_category ON tbl_service_subcategory.category_id = tbl_service_category.id LEFT JOIN tbl_store ON tbl_service_subcategory.store_ID = tbl_store.id`,
      searchColumns: ["tbl_service_subcategory.name", "tbl_service_category.name", "tbl_store.name"],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_service_subcategory.sequence_no ASC, tbl_service_subcategory.id ASC",
      columnMap: {
        0: "tbl_service_subcategory.id",
        1: "tbl_service_subcategory.sequence_no",
        2: "tbl_service_subcategory.name",
        3: "tbl_service_category.name",
        4: isMaster ? "tbl_store.name" : "tbl_service_subcategory.status",
        5: "tbl_service_subcategory.status",
      },
      postProcess: async (rows) => {
        return rows.map((r) => ({
          id: r.id,
          sequence_no: r.sequence_no !== undefined ? r.sequence_no : 0,
          name: r.name || "",
          category_id: r.category_id,
          category_name: r.category_name || "Uncategorized",
          store_id: r.store_ID || r.store_id || "",
          store_name: r.store_name || "",
          status: parseInt(r.status) || 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Subcategory list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addsubcategory", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { id, roll, store } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("write")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    let { category_id, name, sequence_no, active, storeid } = req.body;
    active = active ? "0" : "1";

    const cleanCatId = parseInt(category_id) || 0;
    if (cleanCatId <= 0) {
      req.flash("error", "Please select a valid parent category!");
      return res.redirect("back");
    }

    const adminData = await DataFind(
      `SELECT store_ID, is_staff FROM tbl_admin WHERE id = ${id}`,
    );
    const isStaff = adminData.length > 0 && adminData[0].is_staff != 0;
    const assignedStore =
      adminData.length > 0 &&
      adminData[0].store_ID &&
      String(adminData[0].store_ID) !== "0"
        ? String(adminData[0].store_ID)
        : store
          ? String(store)
          : "1";
    const isMaster =
      rolldetail[0].rollType === "master" &&
      !isStaff &&
      (!adminData[0] || !adminData[0].store_ID || String(adminData[0].store_ID) === "0");

    if (!isMaster) {
      storeid = assignedStore;
    } else if (!storeid) {
      storeid = assignedStore || "1";
    }

    // Auto-assign next sequence number scoped by store and parent category
    const maxRow = await DataFind(
      `SELECT COALESCE(MAX(sequence_no), 0) AS max_seq FROM tbl_service_subcategory WHERE store_ID = '${storeid}' AND category_id = ${cleanCatId} AND delete_flage = '0'`,
    );
    const seqVal = (maxRow && maxRow[0] && Number(maxRow[0].max_seq) + 1) || 1;

    const insertResult = await DataInsert(
      "tbl_service_subcategory",
      "category_id, name, sequence_no, status, store_ID, delete_flage",
      `${cleanCatId}, ${mysql.escape(name)}, ${seqVal}, '${active}', '${storeid}', '0'`,
      req.hostname,
      req.protocol,
    );

    if (insertResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "New Sub Category Added!");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /addsubcategory:", error);
    req.flash("error", "An error occurred while adding sub category");
    return res.redirect(req.get("Referrer") || "/");
  }
});

router.post("/updatesubcategory/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { roll } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("edit")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const subcatId = req.params.id;
    let { category_id, name, active } = req.body;
    active = active ? "0" : "1";
    const cleanCatId = parseInt(category_id) || 0;

    if (cleanCatId <= 0) {
      req.flash("error", "Please select a valid parent category!");
      return res.redirect("back");
    }

    const updateResult = await DataUpdate(
      "tbl_service_subcategory",
      `category_id = ${cleanCatId}, name = ${mysql.escape(name)}, status = '${active}'`,
      `id = ${subcatId}`,
      req.hostname,
      req.protocol,
    );

    if (updateResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    req.flash("success", "Sub Category Updated Successfully!");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /updatesubcategory:", error);
    req.flash("error", "An error occurred while updating sub category");
    return res.redirect("back");
  }
});

router.get("/deletesubcategory/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(req.get("Referrer") || "/");
    }
    const { roll } = req.user;
    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    if (
      !rolldetail ||
      rolldetail.length === 0 ||
      !rolldetail[0].service ||
      !rolldetail[0].service.includes("delete")
    ) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const subcatId = req.params.id;

    const deleteResult = await DataUpdate(
      "tbl_service_subcategory",
      "delete_flage = '1'",
      `id = ${subcatId}`,
      req.hostname,
      req.protocol,
    );

    if (deleteResult === -1) {
      req.flash("error", "Action failed, please check input and try again");
      return res.redirect("back");
    }

    // Set subcategory_id to NULL on any services currently using this subcategory
    await DataFind(`UPDATE tbl_services SET subcategory_id = NULL WHERE subcategory_id = ${subcatId}`);

    req.flash("success", "Sub Category Deleted Successfully");
    return res.redirect("back");
  } catch (error) {
    console.error("Error in /deletesubcategory:", error);
    req.flash("error", "An error occurred while deleting sub category");
    return res.redirect("back");
  }
});

// <<<<<<<<<<<<<<<<<<<< CATEGORIES / SUBCATEGORIES AJAX ENDPOINTS >>>>>>>>>>>>>>>>>>>>

router.get("/categories_by_store/:store_id", auth, async (req, res) => {
  try {
    const storeIdParam = req.params.store_id;
    let whereClause = "delete_flage = '0' AND status = '0'";
    if (storeIdParam && storeIdParam !== "all" && storeIdParam !== "0") {
      const cleanStore = String(storeIdParam).trim().replace(/'/g, "\\'");
      whereClause += ` AND store_ID = '${cleanStore}'`;
    }
    const categories = await DataFind(
      `SELECT id, name, sequence_no, store_ID FROM tbl_service_category WHERE ${whereClause} ORDER BY sequence_no ASC, name ASC`
    );
    return res.status(200).json({ categories });
  } catch (error) {
    console.error("Error in /categories_by_store:", error);
    return res.status(500).json({ categories: [], error: error.message });
  }
});

router.get("/subcategories_by_category/:category_id", auth, async (req, res) => {
  try {
    const catIdParam = parseInt(req.params.category_id) || 0;
    if (catIdParam <= 0) {
      return res.status(200).json({ subcategories: [] });
    }
    const subcategories = await DataFind(
      `SELECT id, name, sequence_no FROM tbl_service_subcategory WHERE category_id = ${catIdParam} AND delete_flage = '0' AND status = '0' ORDER BY sequence_no ASC, name ASC`
    );
    return res.status(200).json({ subcategories });
  } catch (error) {
    console.error("Error in /subcategories_by_category:", error);
    return res.status(500).json({ subcategories: [], error: error.message });
  }
});

// <<<<<<<<<<<<<<<<<<<< UNIFIED SEQUENCE REORDERING & CROSS-PAGE MOVEMENT >>>>>>>>>>>>>>>>>>>>
router.post("/reorder_sequence", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({ success: false, message: "Demo mode: write operations disabled." });
    }

    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    let rolldetail = [];
    if (roll && roll !== "0" && roll !== 0) {
      rolldetail = await DataFind(`
        SELECT sr.*, r.roll_status, r.rollType 
        FROM tbl_staff_roll sr
        JOIN tbl_roll r ON sr.main_roll_id = r.id
        WHERE sr.id = ${roll}
      `);
    }

    const isMaster = Boolean(
      String(loginas) === "1" ||
      Number(loginas) === 1 ||
      (rolldetail && rolldetail.length > 0 && rolldetail[0].rollType === "master") ||
      !store ||
      String(store) === "0"
    );

    const hasServicePermission = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      (accessdata.roll.service.includes("edit") || accessdata.roll.service.includes("write"))
    );

    const canEdit = isMaster || hasServicePermission;

    if (!canEdit) {
      return res.status(403).json({ success: false, message: "Unauthorized to reorder sequences." });
    }

    const { entity, action, reorderList, id: targetId, target_position, page_length } = req.body;

    const entityConfig = {
      category: {
        table: "tbl_service_category",
        seqCol: "sequence_no",
        hasDualSeq: false,
        whereActive: "delete_flage = '0'",
      },
      subcategory: {
        table: "tbl_service_subcategory",
        seqCol: "sequence_no",
        hasDualSeq: false,
        whereActive: "delete_flage = '0'",
      },
      service_type: {
        table: "tbl_services_type",
        seqCol: "sequence_no",
        hasDualSeq: false,
        whereActive: "1 = 1",
      },
      service: {
        table: "tbl_services",
        seqCol: "sequence_no",
        hasDualSeq: true,
        whereActive: "1 = 1",
      },
    };

    const cfg = entityConfig[entity];
    if (!cfg) {
      return res.status(400).json({ success: false, message: "Invalid entity: " + entity });
    }

    // ACTION 1: DRAG & DROP REORDER (within current view / page)
    if (action === "drag_reorder" || Array.isArray(reorderList)) {
      const items = Array.isArray(reorderList) ? reorderList : [];
      for (const item of items) {
        const itemId = parseInt(item.id) || 0;
        const newSeq = parseInt(item.sequence_no) || 0;
        if (itemId > 0 && newSeq >= 0) {
          if (cfg.hasDualSeq) {
            await DataUpdate(
              cfg.table,
              `sequence_no = ${newSeq}, sequance_no = ${newSeq}`,
              `id = ${itemId}`,
              req.hostname,
              req.protocol
            );
          } else {
            await DataUpdate(
              cfg.table,
              `sequence_no = ${newSeq}`,
              `id = ${itemId}`,
              req.hostname,
              req.protocol
            );
          }
        }
      }
      return res.status(200).json({ success: true, message: "Rows reordered successfully" });
    }

    // ACTION 2: MOVE TO POSITION (e.g. Page 3 to Page 1, Move to Top, Move to Bottom, or specific rank)
    if (action === "move_to_position") {
      const itemId = parseInt(targetId) || 0;
      if (itemId <= 0) {
        return res.status(400).json({ success: false, message: "Valid item ID required." });
      }

      const itemRows = await DataFind(`SELECT * FROM ${cfg.table} WHERE id = ${itemId}`);
      if (!itemRows || itemRows.length === 0) {
        return res.status(404).json({ success: false, message: "Item not found." });
      }
      const item = itemRows[0];
      const storeId = (item.store_ID && String(item.store_ID) !== "0") ? String(item.store_ID) : (store ? String(store) : "1");

      const allRows = await DataFind(`
        SELECT id, sequence_no 
        FROM ${cfg.table} 
        WHERE store_ID = '${storeId}' AND ${cfg.whereActive}
        ORDER BY sequence_no ASC, id ASC
      `);

      let idList = allRows.map((r) => r.id);
      const currentIndex = idList.indexOf(itemId);
      if (currentIndex === -1) {
        idList.push(itemId);
      } else {
        idList.splice(currentIndex, 1);
      }

      let newIndex = 0;
      if (target_position === "top" || parseInt(target_position) <= 1) {
        newIndex = 0;
      } else if (target_position === "bottom" || parseInt(target_position) >= idList.length + 1) {
        newIndex = idList.length;
      } else {
        newIndex = Math.max(0, parseInt(target_position) - 1);
        if (newIndex > idList.length) newIndex = idList.length;
      }

      idList.splice(newIndex, 0, itemId);

      for (let i = 0; i < idList.length; i++) {
        const sid = idList[i];
        const assignedSeq = i + 1;
        if (cfg.hasDualSeq) {
          await DataUpdate(
            cfg.table,
            `sequence_no = ${assignedSeq}, sequance_no = ${assignedSeq}`,
            `id = ${sid}`,
            req.hostname,
            req.protocol
          );
        } else {
          await DataUpdate(
            cfg.table,
            `sequence_no = ${assignedSeq}`,
            `id = ${sid}`,
            req.hostname,
            req.protocol
          );
        }
      }

      const pLen = parseInt(page_length) || 10;
      const targetPage = Math.floor(newIndex / pLen);

      return res.status(200).json({
        success: true,
        message: `Item moved to position #${newIndex + 1} successfully.`,
        targetPage,
        newPosition: newIndex + 1,
      });
    }

    return res.status(400).json({ success: false, message: "Invalid action." });
  } catch (error) {
    console.error("Error in /reorder_sequence:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// >>>>>>>>>>>>>>>>>ADD ONS SERVICES ROUTERS <<<<<<<<<<<<<<<<<<<<

router.get("/addon", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    const multiy = await DataFind("SELECT type FROM tbl_master_shop");
    if (multiy[0].type == 1) {
      var ismulty = true;
    } else {
      var ismulty = false;
    }

    if (loginas == 0) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }

    const storeList = await DataFind(
      "SELECT id,name FROM tbl_store WHERE status=1 AND delete_flage=0",
    );

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
      rolldetail[0].service.includes("read")
    ) {
      res.render("addons", {
        addonList: [],
        ismulty,
        storeList,
        accessdata,
        language: req.language_data,
        language_name: req.language_name,
      });
    } else if (
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service.includes("read")
    ) {
      res.render("addons", {
        addonList: [],
        ismulty: false,
        storeList: [],
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

router.get("/addon/data", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);
    if (loginas == 0) {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const rolldetail = await DataFind(`
      SELECT sr.*, r.roll_status, r.rollType 
      FROM tbl_staff_roll sr
      JOIN tbl_roll r ON sr.main_roll_id = r.id
      WHERE sr.id = ${roll}
    `);

    let scopeConditions = [];
    let isMaster = false;
    if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      isMaster = true;
    } else if (
      rolldetail &&
      rolldetail.length > 0 &&
      rolldetail[0].rollType === "store" &&
      rolldetail[0].service &&
      rolldetail[0].service.includes("read")
    ) {
      scopeConditions.push(`tbl_addons.store_ID = '${store}'`);
    } else {
      return res.status(403).json({
        draw: parseInt(req.query.draw) || 1,
        recordsTotal: 0,
        recordsFiltered: 0,
        data: [],
      });
    }

    const filterConditions = [];
    const statusParam = req.query.status_filter || req.query.status;
    if (
      statusParam !== undefined &&
      statusParam !== null &&
      !["all", "ALL", ""].includes(String(statusParam).trim())
    ) {
      const cleanStatus = String(statusParam).trim() === "0" ? "0" : "1";
      filterConditions.push(`tbl_addons.status = '${cleanStatus}'`);
    }

    const storeParam = req.query.store_filter || req.query.store_id;
    if (
      storeParam &&
      isMaster &&
      !["all", "ALL", "", "0"].includes(String(storeParam).trim())
    ) {
      const cleanStore = String(storeParam).trim().replace(/'/g, "\\'");
      filterConditions.push(`tbl_addons.store_ID = '${cleanStore}'`);
    }

    const canEdit = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("edit"),
    );
    const canDelete = Boolean(
      accessdata &&
      accessdata.roll &&
      accessdata.roll.service &&
      accessdata.roll.service.includes("delete"),
    );

    const result = await paginateDataTable(req, {
      select: `tbl_addons.*, COALESCE(tbl_store.name, '') as store`,
      from: `tbl_addons LEFT JOIN tbl_store ON tbl_addons.store_ID = tbl_store.id`,
      searchColumns: ["tbl_addons.addon", "tbl_addons.price", "tbl_store.name"],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_addons.id DESC",
      columnMap: {
        0: "tbl_addons.id",
        1: "tbl_addons.addon",
        2: "tbl_addons.price",
        3: "tbl_store.name",
        4: "tbl_addons.status",
      },
      postProcess: async (rows) => {
        return rows.map((a) => ({
          id: a.id,
          addon: a.addon || "",
          price: parseFloat(a.price) || 0,
          store: a.store || "",
          status: parseInt(a.status) || 0,
          canEdit,
          canDelete,
        }));
      },
    });

    return res.json(result);
  } catch (error) {
    console.error("Addons list data error:", error);
    return res.status(500).json({ error: error.message, data: [] });
  }
});

router.post("/addaddon", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("write")) {
      var { addon_name, addon_price, active, storeid } = req.body;
      active ? (active = 0) : (active = 1);

      storeid ? storeid : (storeid = store);

      // var qury =
      //   "INSERT INTO tbl_addons (addon,price,status,store_ID) VALUE ('" +
      //   addon_name +
      //   "', " +
      //   addon_price +
      //   ", " +
      //   active +
      //   ", " +
      //   storeid +
      //   ")";
      // const newaddons = await DataFind(qury);

      const newaddons = await DataInsert(
        `tbl_addons`,
        `addon,price,status,store_ID`,
        `'${addon_name}', ${addon_price}, ${active}, ${storeid}`,
        req.hostname,
        req.protocol,
      );

      if (newaddons == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New ADDONS Added!");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/deletaddon/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("delete")) {
      var dataid = req.params.id;

      // const newaddons = await DataFind(
      //   "DELETE FROM tbl_addons WHERE id=" + dataid + ""
      // );

      if (
        (await DataDelete(
          `tbl_addons`,
          `id = '${dataid}'`,
          req.hostname,
          req.protocol,
        )) == -1
      ) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Addons Deleted");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.post("/updateaddon/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
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
    if (rolldetail[0].service.includes("edit")) {
      var { addon_name_update, addon_price_update, active_update } = req.body;
      active_update ? (active_update = 0) : (active_update = 1);

      // var qury =
      //   "UPDATE tbl_addons SET addon='" +
      //   addon_name_update +
      //   "',price=" +
      //   addon_price_update +
      //   ",status=" +
      //   active_update +
      //   " WHERE id =" +
      //   req.params.id +
      //   " ";
      // const newaddons = await DataFind(qury);

      const newaddons = await DataUpdate(
        "tbl_addons",
        `addon = '${addon_name_update}', price = ${addon_price_update}, status = ${active_update}`,
        `id = ${req.params.id}`,
        req.hostname,
        req.protocol,
      );

      if (newaddons === -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "Addons Updated");
      res.redirect("back");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
  }
});

router.get("/csv_file", auth, async (req, res) => {
  try {
    const { id, roll, store, loginas } = req.user;
    const accessdata = await access(req.user);

    const isMasterOrStore =
      (accessdata?.logas === "master" || accessdata?.isstore === true) &&
      accessdata?.topbardata?.is_staff == 0;
    if (!isMasterOrStore) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/services/list");
    }

    return res.render("add_csv", {
      accessdata,
      language: req.language_data,
      language_name: req.language_name,
    });
  } catch (error) {
    console.log(error);
    return res.redirect("/services/list");
  }
});

router.get("/demo_csv", auth, async (req, res) => {
  try {
    const accessdata = await access(req.user);

    const isMasterOrStore =
      (accessdata?.logas === "master" || accessdata?.isstore === true) &&
      accessdata?.topbardata?.is_staff == 0;
    if (!isMasterOrStore) {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/services/list");
    }

    let workbook = new Excel.Workbook();
    let worksheet = workbook.addWorksheet("Service_list");

    if (accessdata.topbardata.id == "1") {
      worksheet.columns = [
        { header: "name", key: "name", width: 25 },
        { header: "image", key: "image", width: 35 },
        { header: "services_type_id", key: "services_type_id", width: 25 },
        {
          header: "services_type_price",
          key: "services_type_price",
          width: 25,
        },
        { header: "store_ID", key: "store_ID", width: 25 },
      ];
    } else {
      worksheet.columns = [
        { header: "name", key: "name", width: 25 },
        { header: "image", key: "image", width: 35 },
        { header: "services_type_id", key: "services_type_id", width: 25 },
        {
          header: "services_type_price",
          key: "services_type_price",
          width: 25,
        },
      ];
    }

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=" + "Service_list.csv",
    );
    return workbook.csv.write(res).then(function () {
      res.status(200).end;
    });
  } catch (error) {
    console.log(error);
    return res.redirect("/services/list");
  }
});

router.post(
  "/add_csv",
  auth,
  file_upload.single("csv_file"),
  async (req, res) => {
    try {
      const accessdata = await access(req.user);

      const isMasterOrStore =
        (accessdata?.logas === "master" || accessdata?.isstore === true) &&
        accessdata?.topbardata?.is_staff == 0;
      if (!isMasterOrStore) {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect("/services/list");
      }

      if (process.env.DISABLE_DB_WRITE === "true") {
        req.flash("error", "Demo mode write disabled");
        return res.redirect("/services/csv_file");
      }

      if (!req.file) {
        req.flash("error", "Please select a CSV file to upload");
        return res.redirect("/services/csv_file");
      }

      const filename = path.join(
        __dirname,
        "../public/uploads/" + req.file.filename,
      );

      // Read and parse all CSV rows reliably
      const rows = [];
      try {
        await new Promise((resolve, reject) => {
          fs.createReadStream(filename)
            .pipe(parse({ headers: true, trim: true }))
            .on("data", (row) => rows.push(row))
            .on("end", () => resolve())
            .on("error", (err) => reject(err));
        });
      } catch (parseError) {
        console.error("CSV parse error:", parseError);
        if (fs.existsSync(filename)) fs.unlinkSync(filename);
        req.flash("error", "Failed to parse CSV file: " + (parseError.message || "Invalid format"));
        return res.redirect("/services/csv_file");
      }

      // Clean up uploaded file from disk
      if (fs.existsSync(filename)) {
        fs.unlinkSync(filename);
      }

      if (rows.length === 0) {
        req.flash("error", "The uploaded CSV file contains no data rows.");
        return res.redirect("/services/csv_file");
      }

      const isMaster = accessdata?.logas === "master" || !accessdata?.topbardata?.store_ID;
      let successCount = 0;
      let skippedCount = 0;
      const errors = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const rowNum = i + 2;

        const name = (row.name || "").trim();
        const image = (row.image || "").trim();
        const services_type_id = (row.services_type_id || "").trim();
        const services_type_price = (row.services_type_price || "").trim();

        // Resolve store ID
        let store_ID = "";
        if (isMaster) {
          store_ID = (row.store_ID || "").trim() || (row.store_id || "").trim();
          if (!store_ID) {
            errors.push(`Row ${rowNum} (${name || 'Item'}): store_ID is required for Master Admin`);
            skippedCount++;
            continue;
          }
        } else {
          store_ID = String(accessdata.topbardata.store_ID);
        }

        if (!name) {
          errors.push(`Row ${rowNum}: Service name is required`);
          skippedCount++;
          continue;
        }

        if (!services_type_id) {
          errors.push(`Row ${rowNum} (${name}): services_type_id is required`);
          skippedCount++;
          continue;
        }

        if (!services_type_price) {
          errors.push(`Row ${rowNum} (${name}): services_type_price is required`);
          skippedCount++;
          continue;
        }

        // Split variant IDs and prices
        const typeIds = services_type_id.split(",").map((s) => s.trim()).filter(Boolean);
        const prices = services_type_price.split(",").map((s) => s.trim()).filter(Boolean);

        if (typeIds.length === 0) {
          errors.push(`Row ${rowNum} (${name}): No valid service type IDs`);
          skippedCount++;
          continue;
        }

        // Verify that all service type IDs exist in tbl_services_type
        const idListEscaped = typeIds.map((tid) => `'${tid.replace(/'/g, "\\'")}'`).join(",");
        const typeCheck = await DataFind(
          `SELECT id FROM tbl_services_type WHERE id IN (${idListEscaped})`
        );
        const foundIds = typeCheck ? typeCheck.map((t) => String(t.id)) : [];
        const missingIds = typeIds.filter((tid) => !foundIds.includes(String(tid)));

        if (missingIds.length > 0) {
          errors.push(`Row ${rowNum} (${name}): Service type ID(s) [${missingIds.join(", ")}] not found`);
          skippedCount++;
          continue;
        }

        // Generate default tier sequence, items quantity, and ready times
        const count = typeIds.length;
        const services_type_sequence = Array.from({ length: count }, (_, idx) => idx + 1).join(",");
        const services_type_items = Array.from({ length: count }, () => 1).join(",");
        const services_type_ready_time = Array.from({ length: count }, () => 0).join(",");
        const sequence_no = parseInt(row.sequence_no) || 0;
        const no_of_items = parseInt(row.no_of_items) > 0 ? parseInt(row.no_of_items) : 1;
        const status = "0"; // Active

        const cleanName = name.replace(/'/g, "\\'");
        const cleanImage = image.replace(/'/g, "\\'");
        const cleanTypeIds = typeIds.join(",");
        const cleanPrices = prices.join(",");
        const cleanStoreId = store_ID.replace(/'/g, "\\'");

        const insertRes = await DataInsert(
          "tbl_services",
          "name, image, services_type_id, services_type_price, store_ID, status, sequence_no, no_of_items, services_type_sequence, services_type_items, services_type_ready_time",
          `'${cleanName}', '${cleanImage}', '${cleanTypeIds}', '${cleanPrices}', '${cleanStoreId}', '${status}', ${sequence_no}, ${no_of_items}, '${services_type_sequence}', '${services_type_items}', '${services_type_ready_time}'`,
          req.hostname,
          req.protocol
        );

        if (insertRes === -1) {
          errors.push(`Row ${rowNum} (${name}): Insert failed`);
          skippedCount++;
        } else {
          successCount++;
        }
      }

      if (successCount > 0) {
        req.flash(
          "success",
          `Successfully imported ${successCount} service(s).` +
            (skippedCount > 0 ? ` (${skippedCount} skipped: ${errors.slice(0, 3).join("; ")})` : "")
        );
        return res.redirect("/services/list");
      } else {
        req.flash(
          "error",
          `Failed to import services: ${errors.length > 0 ? errors.slice(0, 3).join("; ") : "Invalid CSV data"}`
        );
        return res.redirect("/services/csv_file");
      }
    } catch (error) {
      console.error("Bulk CSV upload error:", error);
      req.flash("error", "Server error processing CSV file: " + error.message);
      return res.redirect("/services/csv_file");
    }
  },
);

module.exports = router;
