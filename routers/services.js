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

      res.render("service", {
        servicesdata: [],
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
      res.render("service", {
        servicesdata: [],
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
               (SELECT GROUP_CONCAT(tbl_services_type.services_type) FROM tbl_services_type WHERE FIND_IN_SET(tbl_services_type.id, tbl_services.services_type_id)) as serviceType`,
      from: `tbl_services LEFT JOIN tbl_store ON tbl_services.store_ID = tbl_store.id`,
      searchColumns: ["tbl_services.name", "tbl_store.name"],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_services.sequence_no ASC, tbl_services.id ASC",
      columnMap: {
        0: "tbl_services.id",
        1: "tbl_services.sequence_no",
        2: "tbl_services.name",
        3: "tbl_services.id",
        4: isMaster ? "tbl_store.name" : "tbl_services.status",
        5: "tbl_services.status",
      },
      postProcess: async (rows) => {
        return rows.map((s) => ({
          id: s.id,
          sequence_no: s.sequence_no !== undefined ? s.sequence_no : 0,
          name: s.name || "",
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

    res.render("add_service", {
      ismulty,
      storeList,
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
        sequence_no,
        service_type_seq,
        service_type,
        service_price,
        service_type_items,
        service_type_ready_time,
        active,
        storeid,
      } = req.body;

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
      const cleanSeqNo = parseInt(sequence_no) || 0;

      const newservtype = await DataInsert(
        `tbl_services`,
        `name,image,sequence_no,services_type_sequence,services_type_id,services_type_price,services_type_items,services_type_ready_time,store_ID,status`,
        `'${name}', '${img}', '${cleanSeqNo}', '${normalized.services_type_sequence}', '${normalized.services_type_id}', '${normalized.services_type_price}', '${normalized.services_type_items}', '${normalized.services_type_ready_time}', '${storeid}', '${active}'`,
        req.hostname,
        req.protocol,
      );

      if (newservtype == -1) {
        req.flash("error", "Action failed, please check input and try again");
        return res.redirect("back");
      }

      req.flash("success", "New Service Added Successfully!");
      res.redirect("/services/list");
    } else {
      req.flash("error", "Your Are Not Authorized For this");
      return res.redirect(req.get("Referrer") || "/");
    }
  } catch (error) {
    console.log(error);
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

      res.render("edit_service", {
        services: servicesdata[0],
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
          sequence_no_update,
          service_type_seq,
          service_type,
          service_price,
          service_type_items,
          service_type_ready_time,
          active_update,
        } = req.body;

        const normalized = normalizeParallelTiers(
          service_type_seq,
          service_type,
          service_price,
          service_type_items,
          service_type_ready_time,
        );
        active_update = active_update ? 0 : 1;
        const cleanSeqNo = parseInt(sequence_no_update) || 0;

        const newservtype = await DataUpdate(
          "tbl_services",
          `name = '${name_update}', sequence_no = '${cleanSeqNo}', services_type_sequence = '${normalized.services_type_sequence}', services_type_id = '${normalized.services_type_id}', services_type_price = '${normalized.services_type_price}', services_type_items = '${normalized.services_type_items}', services_type_ready_time = '${normalized.services_type_ready_time}', status = '${active_update}'`,
          `id = ${req.params.id}`,
          req.hostname,
          req.protocol,
        );

        if (newservtype === -1) {
          req.flash("error", "Action failed, please check input and try again");
          return res.redirect("back");
        }

        req.flash("success", "Services Updated");
        res.redirect("/services/list");
      } else {
        req.flash("error", "Your Are Not Authorized For this");
        return res.redirect(req.get("Referrer") || "/");
      }
    } catch (error) {
      console.log(error);
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
    if (
      rolldetail[0].rollType === "master" &&
      rolldetail[0].service.includes("read")
    ) {
      res.render("service_type", {
        servicesTypeList: [],
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
      res.render("service_type", {
        servicesTypeList: [],
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
        "tbl_services_type.id",
        "tbl_store.name",
      ],
      baseWhere: scopeConditions,
      filterWhere: filterConditions,
      defaultOrder: "tbl_services_type.id DESC",
      columnMap: {
        0: "tbl_services_type.id",
        1: "tbl_services_type.services_type",
        2: "tbl_services_type.id",
        3: "tbl_store.name",
        4: "tbl_services_type.status",
      },
      postProcess: async (rows) => {
        return rows.map((st) => ({
          id: st.id,
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

      // var qury =
      //   "INSERT INTO tbl_services_type (services_type,status,store_ID) VALUE ('" +
      //   service_name +
      //   "', " +
      //   active +
      //   "," +
      //   storeid +
      //   ")";
      // const newservtype = await DataFind(qury);

      const newservtype = await DataInsert(
        `tbl_services_type`,
        `services_type,status,store_ID`,
        `${await mysql.escape(service_name)}, ${active}, ${storeid}`,
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

      // const newservtype = await DataFind(
      //   "UPDATE tbl_services_type SET services_type='" +
      //     service_name +
      //     "', status=" +
      //     active +
      //     " WHERE id=" +
      //     dataid +
      //     ""
      // );

      const updateServiceType = await DataUpdate(
        "tbl_services_type",
        `services_type = '${service_name}', status = ${active}`,
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

      var filename = path.join(
        __dirname,
        "../public/uploads/" + req.file.filename,
      );
      console.log(req.file.filename);

      fs.createReadStream(filename)
        .pipe(parse({ headers: true }))
        .on("error", (error) => {
          console.error(error);
          req.flash("error", "Issue with uploaded file1");
          return res.render("add_csv", {
            accessdata,
            language: req.language_data,
            language_name: req.language_name,
            error: req.flash("error"),
          });
        })
        .on("data", async (row) => {
          console.log(accessdata);

          if (accessdata.topbardata.store_ID == "") {
            if (row.store_ID == undefined) {
              req.flash("error", "Issue with uploaded file2");
              return res.render("add_csv", {
                accessdata,
                language: req.language_data,
                language_name: req.language_name,
                error: req.flash("error"),
              });
            } else if (
              row.name != "" &&
              row.image != "" &&
              row.services_type_id != "" &&
              row.services_type_price != "" &&
              row.store_ID != ""
            ) {
              console.log(row);
              const data_split = row.services_type_id.split(",");
              console.log("data_split", data_split);

              const results = await DataFind(
                `SELECT COUNT(*) AS count FROM tbl_services_type WHERE id IN (${data_split})`,
              );
              const count = results[0].count;

              if (data_split.length == count) {
                // await DataFind(`INSERT INTO tbl_services (name, image, services_type_id, services_type_price, store_ID) VALUE
                //         ('${row.name}', '${row.image}', '${row.services_type_id}', '${row.services_type_price}', '${row.store_ID}')`);

                const data = await DataInsert(
                  `tbl_services`,
                  `name, image, services_type_id, services_type_price, store_ID`,
                  `'${row.name}', '${row.image}', '${row.services_type_id}', '${row.services_type_price}', '${row.store_ID}'`,
                  req.hostname,
                  req.protocol,
                );

                if (data == -1) {
                  req.flash(
                    "error",
                    "Action failed, please check input and try again",
                  );
                  return res.redirect("back");
                }
              }

              req.flash("success", "Successfully Uploaded");
              return res.render("add_csv", {
                accessdata,
                language: req.language_data,
                language_name: req.language_name,
                success: req.flash("success"),
              });
            }
          } else {
            if (row.store_ID) {
              console.log(row);

              req.flash("error", "Issue with uploaded fil3");
              return res.render("add_csv", {
                accessdata,
                language: req.language_data,
                language_name: req.language_name,
                error: req.flash("error"),
              });
            }
            if (
              row.name != "" &&
              row.image != "" &&
              row.services_type_id != "" &&
              row.services_type_price != ""
            ) {
              console.log(row);
              const data_split = row.services_type_id.split(",");
              console.log("data_split", data_split);

              const results = await DataFind(
                `SELECT COUNT(*) AS count FROM tbl_services_type WHERE id IN (${data_split})`,
              );
              const count = results[0].count;

              if (data_split.length == count) {
                // await DataFind(`INSERT INTO tbl_services (name, image, services_type_id, services_type_price, store_ID) VALUE
                //         ('${row.name}', '${row.image}', '${row.services_type_id}', '${row.services_type_price}', '${accessdata.topbardata.store_ID}')`);

                const data = await DataInsert(
                  `tbl_services`,
                  `name, image, services_type_id, services_type_price, store_ID`,
                  `'${row.name}', '${row.image}', '${row.services_type_id}', '${row.services_type_price}', '${accessdata.topbardata.store_ID}'`,
                  req.hostname,
                  req.protocol,
                );

                if (data == -1) {
                  req.flash(
                    "error",
                    "Action failed, please check input and try again",
                  );
                  return res.redirect("back");
                }
              }

              req.flash("success", "Successfully Uploaded");
              return res.render("add_csv", {
                accessdata,
                language: req.language_data,
                language_name: req.language_name,
                success: req.flash("success"),
              });
            }
          }
        });
    } catch (error) {
      console.log(44444, error);
      return res.redirect("/services/list");
    }
  },
);

module.exports = router;
