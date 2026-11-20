const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
const { conn, mySqlQury } = require("../middelwer/db");
const { resolvePosServiceImageUrl } = require("../middelwer/posImageHelper");

// Dedicated upload directory for job type images
const UPLOAD_SUBDIR = path.join(__dirname, "../public/uploads/job-types");
if (!fs.existsSync(UPLOAD_SUBDIR)) {
  fs.mkdirSync(UPLOAD_SUBDIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    if (!fs.existsSync(UPLOAD_SUBDIR)) {
      fs.mkdirSync(UPLOAD_SUBDIR, { recursive: true });
    }
    cb(null, UPLOAD_SUBDIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || "").toLowerCase();
    const base = path
      .basename(file.originalname || "job_type", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const uploadJobTypeImage = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowedMimes = ["image/png", "image/jpg", "image/jpeg", "image/webp"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error("Only .png, .jpg, .jpeg and .webp image formats are allowed!");
      err.name = "ExtensionError";
      cb(err, false);
    }
  },
});

function handleImageUpload(req, res, next) {
  uploadJobTypeImage.single("image")(req, res, (err) => {
    if (err) {
      req.flash("error", err.message || "Invalid image upload");
      return res.redirect(req.get("Referrer") || "/job-types");
    }
    return next();
  });
}

function safeUnlinkJobTypeImage(filename) {
  if (!filename || typeof filename !== "string") return;
  const safeName = path.basename(filename.trim());
  if (!safeName) return;
  const fullPath = path.join(UPLOAD_SUBDIR, safeName);
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn(`[JobTypes] Could not delete image ${safeName}:`, err.message);
  }
}

function normalizeStatus(raw) {
  if (raw === undefined || raw === null) return "active";
  const str = String(raw).trim().toLowerCase();
  if (str === "inactive" || str === "0" || str === "false" || str === "deactive" || str === "disabled") {
    return "inactive";
  }
  return "active";
}

function collectDescendantIds(rows, rootId) {
  const targetId = Number(rootId);
  const childrenByParent = new Map();
  for (const r of rows) {
    const pid = r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null;
    if (pid !== null) {
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid).push(Number(r.id));
    }
  }

  const descendants = new Set();
  const stack = [...(childrenByParent.get(targetId) || [])];
  while (stack.length > 0) {
    const cur = stack.pop();
    if (!descendants.has(cur)) {
      descendants.add(cur);
      const kids = childrenByParent.get(cur) || [];
      for (const k of kids) stack.push(k);
    }
  }
  return descendants;
}

function buildJobTypeTree(rows) {
  const byId = new Map();
  const roots = [];

  for (const r of rows) {
    byId.set(Number(r.id), {
      id: Number(r.id),
      store_id: Number(r.store_id) || 0,
      store_name: r.store_name || "",
      parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
      name: r.name || "",
      description: r.description || "",
      image: r.image || "",
      image_url: r.image ? `/uploads/job-types/${encodeURIComponent(path.basename(r.image))}` : "",
      status: normalizeStatus(r.status),
      pricedCount: Number(r.priced_count) || 0,
      children: [],
      depth: 0,
      childCount: 0,
      totalDescendantCount: 0,
    });
  }

  for (const node of byId.values()) {
    const parentNode = node.parent_id !== null ? byId.get(node.parent_id) : null;
    if (
      parentNode &&
      parentNode.id !== node.id &&
      parentNode.store_id === node.store_id
    ) {
      parentNode.children.push(node);
    } else {
      roots.push(node);
    }
  }

  function sortAndCompute(nodes, depth) {
    nodes.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id);
    let total = 0;
    for (const node of nodes) {
      node.depth = depth;
      node.childCount = node.children.length;
      const subTotal = sortAndCompute(node.children, depth + 1);
      node.totalDescendantCount = subTotal;
      total += 1 + subTotal;
    }
    return total;
  }

  sortAndCompute(roots, 0);
  return roots;
}

function flattenTreeOptions(treeNodes, excludeIds = new Set()) {
  const options = [];
  function walk(nodes, depth) {
    for (const node of nodes) {
      if (excludeIds.has(node.id)) continue;
      const prefix = depth > 0 ? `${"\u00A0\u00A0\u00A0".repeat(depth)}└─ ` : "";
      options.push({
        id: node.id,
        store_id: node.store_id,
        name: node.name,
        depth,
        label: `${prefix}${node.name}`,
        status: node.status,
      });
      if (node.children && node.children.length > 0) {
        walk(node.children, depth + 1);
      }
    }
  }
  walk(treeNodes, 0);
  return options;
}

function buildJobTypeBreadcrumb(rows, targetId) {
  const byId = new Map();
  for (const r of rows || []) {
    byId.set(Number(r.id), {
      id: Number(r.id),
      parent_id: r.parent_id !== null && r.parent_id !== undefined ? Number(r.parent_id) : null,
      name: r.name || "",
    });
  }
  const chain = [];
  const visited = new Set();
  let cur = byId.get(Number(targetId));
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    chain.unshift({ id: cur.id, name: cur.name });
    cur = cur.parent_id !== null ? byId.get(cur.parent_id) : null;
  }
  return chain;
}

function parsePriceEntries(body, validServiceIdSet, storeId, jobTypeId) {
  let rawMap = {};
  if (body && body.prices_payload !== undefined && body.prices_payload !== null && String(body.prices_payload).trim() !== "") {
    if (typeof body.prices_payload === "string") {
      try {
        const parsed = JSON.parse(body.prices_payload);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          rawMap = parsed;
        }
      } catch (err) {
        rawMap = {};
      }
    } else if (typeof body.prices_payload === "object" && !Array.isArray(body.prices_payload)) {
      rawMap = body.prices_payload;
    }
  } else if (body && body.prices && typeof body.prices === "object" && !Array.isArray(body.prices)) {
    rawMap = body.prices;
  }

  const positiveRows = [];
  const zeroedServiceIds = [];

  for (const [rawKey, rawVal] of Object.entries(rawMap)) {
    const serviceId = Number(rawKey);
    if (!Number.isInteger(serviceId) || serviceId <= 0) continue;
    if (!validServiceIdSet.has(serviceId)) continue;

    const strVal = rawVal === undefined || rawVal === null ? "" : String(rawVal).trim();
    if (strVal === "") {
      zeroedServiceIds.push(serviceId);
      continue;
    }

    const numeric = Number(strVal);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      zeroedServiceIds.push(serviceId);
      continue;
    }

    const rounded = Math.round(numeric * 100) / 100;
    if (rounded > 0) {
      positiveRows.push([Number(storeId), Number(jobTypeId), serviceId, rounded]);
    } else {
      zeroedServiceIds.push(serviceId);
    }
  }

  return { positiveRows, zeroedServiceIds };
}

async function resolvePermissions(req) {
  const { id, roll, store, loginas } = req.user;
  const accessdata = await access(req.user);

  if (loginas == 0 || accessdata?.logas === "custmor") {
    return {
      accessdata,
      isMaster: false,
      isStaff: false,
      isStoreManager: false,
      ismulty: false,
      assignedStoreId: 0,
      assignedStoreName: "",
      storeList: [],
      canRead: false,
      canWrite: false,
      canEdit: false,
      canDelete: false,
    };
  }

  const [rolldetail, adminData, masterShop, storeList] = await Promise.all([
    mySqlQury(
      `SELECT sr.*, r.roll_status, r.rollType
       FROM tbl_staff_roll sr
       JOIN tbl_roll r ON sr.main_roll_id = r.id
       WHERE sr.id = ? LIMIT 1`,
      [roll]
    ),
    mySqlQury("SELECT store_ID, is_staff FROM tbl_admin WHERE id = ? LIMIT 1", [id]),
    mySqlQury("SELECT type, fromStore FROM tbl_master_shop LIMIT 1"),
    mySqlQury("SELECT id, name FROM tbl_store WHERE status = '1' AND delete_flage = '0' ORDER BY name ASC, id ASC"),
  ]);

  const r0 = rolldetail && rolldetail.length > 0 ? rolldetail[0] : {};
  const a0 = adminData && adminData.length > 0 ? adminData[0] : {};
  const m0 = masterShop && masterShop.length > 0 ? masterShop[0] : {};

  const isStaff = a0.is_staff !== undefined && String(a0.is_staff) !== "0";
  const isMaster = (r0.rollType === "master" || accessdata?.logas === "master") && !isStaff;
  const isStoreManager =
    (r0.rollType === "store" || accessdata?.isstore === true || accessdata?.logas === "store") &&
    !isStaff;

  const isMultiStoreEnabled = String(m0.type || "0") === "1";
  const ismulty = isMaster && isMultiStoreEnabled;

  // Resolve assigned store ID for store managers, staff, or single-store master
  let rawStoreId =
    a0.store_ID && String(a0.store_ID).trim() !== "" && String(a0.store_ID) !== "0"
      ? Number(a0.store_ID)
      : store && String(store).trim() !== "" && String(store) !== "0"
        ? Number(store)
        : 0;

  if (!rawStoreId) {
    if (m0.fromStore && Number(m0.fromStore) > 0) {
      rawStoreId = Number(m0.fromStore);
    } else if (storeList && storeList.length > 0) {
      rawStoreId = Number(storeList[0].id);
    } else {
      rawStoreId = 1;
    }
  }

  const matchedStore = (storeList || []).find((s) => Number(s.id) === rawStoreId);
  const assignedStoreName = matchedStore ? matchedStore.name : "";

  const orderPerms = String(r0.orders || accessdata?.roll?.orders || "");
  const servicePerms = String(r0.service || accessdata?.roll?.service || "");
  const hasFullAccess = isMaster || isStoreManager;

  return {
    accessdata,
    isMaster,
    isStaff,
    isStoreManager,
    ismulty,
    assignedStoreId: rawStoreId,
    assignedStoreName,
    storeList: storeList || [],
    canRead: hasFullAccess || orderPerms.includes("read") || servicePerms.includes("read"),
    canWrite: hasFullAccess || orderPerms.includes("write") || orderPerms.includes("edit") || servicePerms.includes("write"),
    canEdit: hasFullAccess || orderPerms.includes("edit") || servicePerms.includes("edit"),
    canDelete: hasFullAccess || orderPerms.includes("delete") || servicePerms.includes("delete"),
  };
}

// =====================================================================
// GET /job-types — Tree List View (Store-Scoped)
// =====================================================================
router.get("/", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canRead) {
      req.flash("error", "You are not authorized to access Job Types.");
      return res.redirect(req.get("Referrer") || "/index");
    }

    let selectedStoreId = "all";
    let querySql = `
      SELECT jt.id, jt.store_id, jt.parent_id, jt.name, jt.description, jt.image, jt.status,
             COALESCE(s.name, '') AS store_name,
             COALESCE(p.priced_count, 0) AS priced_count
      FROM tbl_job_types jt
      LEFT JOIN tbl_store s ON jt.store_id = s.id
      LEFT JOIN (
        SELECT job_type_id, COUNT(*) AS priced_count
        FROM tbl_job_item_prices
        WHERE price > 0
        GROUP BY job_type_id
      ) p ON p.job_type_id = jt.id
    `;
    const params = [];

    if (!perms.ismulty) {
      selectedStoreId = String(perms.assignedStoreId);
      querySql += " WHERE jt.store_id = ?";
      params.push(perms.assignedStoreId);
    } else if (req.query.store_id && String(req.query.store_id).trim() !== "" && String(req.query.store_id) !== "all") {
      const parsedFilterStore = Number(req.query.store_id);
      if (Number.isInteger(parsedFilterStore) && parsedFilterStore > 0) {
        selectedStoreId = String(parsedFilterStore);
        querySql += " WHERE jt.store_id = ?";
        params.push(parsedFilterStore);
      }
    }

    querySql += " ORDER BY jt.store_id ASC, jt.name ASC, jt.id ASC";
    const rows = await mySqlQury(querySql, params);

    const jobTypeTree = buildJobTypeTree(rows);
    const totalCount = rows.length;
    const rootCount = jobTypeTree.length;
    const subCount = Math.max(0, totalCount - rootCount);
    const activeCount = rows.filter((r) => normalizeStatus(r.status) === "active").length;
    const inactiveCount = totalCount - activeCount;

    return res.render("job_types", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      selectedStoreId,
      assignedStoreId: perms.assignedStoreId,
      assignedStoreName: perms.assignedStoreName,
      jobTypeTree,
      stats: {
        total: totalCount,
        roots: rootCount,
        subtypes: subCount,
        active: activeCount,
        inactive: inactiveCount,
      },
      perms: {
        canWrite: perms.canWrite,
        canEdit: perms.canEdit,
        canDelete: perms.canDelete,
      },
    });
  } catch (error) {
    console.error("Error in GET /job-types:", error);
    req.flash("error", "Failed to load Job Types.");
    return res.redirect("/index");
  }
});

// =====================================================================
// GET /job-types/parents-by-store/:store_id — Dynamic Parent Options API
// =====================================================================
router.get("/parents-by-store/:store_id", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canRead) {
      return res.status(403).json({ success: false, message: "Not authorized.", options: [] });
    }

    const targetStoreId = perms.ismulty
      ? Number(req.params.store_id) || 0
      : perms.assignedStoreId;

    if (!Number.isInteger(targetStoreId) || targetStoreId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid store ID.", options: [] });
    }

    const rows = await mySqlQury(
      `SELECT id, store_id, parent_id, name, description, image, status
       FROM tbl_job_types
       WHERE store_id = ?
       ORDER BY name ASC, id ASC`,
      [targetStoreId]
    );

    const excludeIds = new Set();
    if (req.query.exclude_id) {
      const exId = Number(req.query.exclude_id);
      if (Number.isInteger(exId) && exId > 0) {
        for (const d of collectDescendantIds(rows, exId)) excludeIds.add(d);
        excludeIds.add(exId);
      }
    }

    const tree = buildJobTypeTree(rows);
    const options = flattenTreeOptions(tree, excludeIds);

    return res.status(200).json({ success: true, store_id: targetStoreId, options });
  } catch (error) {
    console.error("Error in GET /job-types/parents-by-store/:store_id:", error);
    return res.status(500).json({ success: false, message: "Failed to load parent job types.", options: [] });
  }
});

// =====================================================================
// GET /job-types/create — Dedicated Create Page (Store-Scoped)
// =====================================================================
router.get("/create", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canWrite) {
      req.flash("error", "You are not authorized to create Job Types.");
      return res.redirect("/job-types");
    }

    let targetStoreId = perms.assignedStoreId;
    let validPreselectedParent = null;

    // If ?parent_id= is provided, detect its store_id (enforcing ownership for non-master)
    if (req.query.parent_id) {
      const parsedParent = Number(req.query.parent_id);
      if (Number.isInteger(parsedParent) && parsedParent > 0) {
        const parentRows = await mySqlQury(
          "SELECT id, store_id FROM tbl_job_types WHERE id = ? LIMIT 1",
          [parsedParent]
        );
        if (parentRows && parentRows.length > 0) {
          const pStoreId = Number(parentRows[0].store_id);
          if (perms.ismulty || pStoreId === perms.assignedStoreId) {
            targetStoreId = pStoreId;
            validPreselectedParent = parsedParent;
          }
        }
      }
    } else if (perms.ismulty && req.query.store_id && String(req.query.store_id) !== "all") {
      const qStore = Number(req.query.store_id);
      if (Number.isInteger(qStore) && perms.storeList.some((s) => Number(s.id) === qStore)) {
        targetStoreId = qStore;
      }
    } else if (perms.ismulty && perms.storeList.length > 0 && !perms.storeList.some((s) => Number(s.id) === targetStoreId)) {
      targetStoreId = Number(perms.storeList[0].id);
    }

    const rows = await mySqlQury(
      `SELECT id, store_id, parent_id, name, description, image, status
       FROM tbl_job_types
       WHERE store_id = ?
       ORDER BY name ASC, id ASC`,
      [targetStoreId]
    );
    const tree = buildJobTypeTree(rows);
    const parentOptions = flattenTreeOptions(tree);

    const targetStoreObj = perms.storeList.find((s) => Number(s.id) === targetStoreId);

    return res.render("job_type_form", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      mode: "create",
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      jobType: {
        id: null,
        store_id: targetStoreId,
        store_name: targetStoreObj ? targetStoreObj.name : perms.assignedStoreName,
        parent_id: validPreselectedParent,
        name: "",
        description: "",
        image: "",
        image_url: "",
        status: "active",
      },
      parentOptions,
    });
  } catch (error) {
    console.error("Error in GET /job-types/create:", error);
    req.flash("error", "Failed to load Create Job Type page.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// POST /job-types/create — Persist New Store-Scoped Job Type
// =====================================================================
router.post("/create", auth, handleImageUpload, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/job-types");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canWrite) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "You are not authorized to create Job Types.");
      return res.redirect("/job-types");
    }

    // Determine target store_id (non-master strictly locked to assignedStoreId)
    let targetStoreId = perms.assignedStoreId;
    if (perms.ismulty) {
      const submittedStore = Number(req.body.store_id);
      if (!Number.isInteger(submittedStore) || submittedStore <= 0) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Please select a valid store.");
        return res.redirect(req.get("Referrer") || "/job-types/create");
      }
      const storeExists = await mySqlQury(
        "SELECT id FROM tbl_store WHERE id = ? AND delete_flage = '0' LIMIT 1",
        [submittedStore]
      );
      if (!storeExists || storeExists.length === 0) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Selected store does not exist.");
        return res.redirect(req.get("Referrer") || "/job-types/create");
      }
      targetStoreId = submittedStore;
    }

    const name = String(req.body.name || "").trim();
    if (!name) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "Job Type name is required.");
      return res.redirect(req.get("Referrer") || "/job-types/create");
    }

    let parentId = null;
    if (req.body.parent_id !== undefined && String(req.body.parent_id).trim() !== "") {
      const parsedParent = Number(req.body.parent_id);
      if (!Number.isInteger(parsedParent) || parsedParent <= 0) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Invalid parent job type selected.");
        return res.redirect(req.get("Referrer") || "/job-types/create");
      }
      const parentCheck = await mySqlQury(
        "SELECT id, store_id FROM tbl_job_types WHERE id = ? LIMIT 1",
        [parsedParent]
      );
      if (!parentCheck || parentCheck.length === 0) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Selected parent job type does not exist.");
        return res.redirect(req.get("Referrer") || "/job-types/create");
      }
      if (Number(parentCheck[0].store_id) !== Number(targetStoreId)) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Parent job type must belong to the same store.");
        return res.redirect(req.get("Referrer") || "/job-types/create");
      }
      parentId = parsedParent;
    }

    const description = req.body.description !== undefined ? String(req.body.description).trim() : null;
    const status = normalizeStatus(req.body.status);
    const image = req.file ? req.file.filename : null;

    await mySqlQury(
      `INSERT INTO tbl_job_types (store_id, parent_id, name, description, image, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetStoreId, parentId, name, description || null, image, status]
    );

    req.flash("success", `Job Type "${name}" created successfully!`);
    return res.redirect(perms.ismulty ? `/job-types?store_id=${targetStoreId}` : "/job-types");
  } catch (error) {
    if (req.file) safeUnlinkJobTypeImage(req.file.filename);
    console.error("Error in POST /job-types/create:", error);
    req.flash("error", "Failed to create Job Type.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// GET /job-types/edit/:id — Dedicated Edit Page (Store-Scoped)
// =====================================================================
router.get("/edit/:id", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canEdit) {
      req.flash("error", "You are not authorized to edit Job Types.");
      return res.redirect("/job-types");
    }

    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      req.flash("error", "Invalid Job Type ID.");
      return res.redirect("/job-types");
    }

    const targetRows = await mySqlQury(
      `SELECT jt.id, jt.store_id, jt.parent_id, jt.name, jt.description, jt.image, jt.status,
              COALESCE(s.name, '') AS store_name
       FROM tbl_job_types jt
       LEFT JOIN tbl_store s ON jt.store_id = s.id
       WHERE jt.id = ? LIMIT 1`,
      [jtId]
    );

    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Job Type not found.");
      return res.redirect("/job-types");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to edit job types belonging to another store.");
      return res.redirect("/job-types");
    }

    // Load only job types belonging to the SAME store
    const storeRows = await mySqlQury(
      `SELECT id, store_id, parent_id, name, description, image, status
       FROM tbl_job_types
       WHERE store_id = ?
       ORDER BY name ASC, id ASC`,
      [targetStoreId]
    );

    // Exclude self and all descendants to prevent circular hierarchy
    const excludeIds = collectDescendantIds(storeRows, jtId);
    excludeIds.add(jtId);

    const tree = buildJobTypeTree(storeRows);
    const parentOptions = flattenTreeOptions(tree, excludeIds);

    return res.render("job_type_form", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      mode: "edit",
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      jobType: {
        id: Number(target.id),
        store_id: targetStoreId,
        store_name: target.store_name || perms.assignedStoreName,
        parent_id: target.parent_id !== null && target.parent_id !== undefined ? Number(target.parent_id) : null,
        name: target.name || "",
        description: target.description || "",
        image: target.image || "",
        image_url: target.image
          ? `/uploads/job-types/${encodeURIComponent(path.basename(target.image))}`
          : "",
        status: normalizeStatus(target.status),
      },
      parentOptions,
    });
  } catch (error) {
    console.error("Error in GET /job-types/edit/:id:", error);
    req.flash("error", "Failed to load Edit Job Type page.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// POST /job-types/edit/:id — Update Job Type (Store-Scoped)
// =====================================================================
router.post("/edit/:id", auth, handleImageUpload, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/job-types");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canEdit) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "You are not authorized to edit Job Types.");
      return res.redirect("/job-types");
    }

    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "Invalid Job Type ID.");
      return res.redirect("/job-types");
    }

    const existingRows = await mySqlQury(
      "SELECT id, store_id, parent_id, name, description, image, status FROM tbl_job_types WHERE id = ? LIMIT 1",
      [jtId]
    );
    if (!existingRows || existingRows.length === 0) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "Job Type not found.");
      return res.redirect("/job-types");
    }

    const existing = existingRows[0];
    const targetStoreId = Number(existing.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "You are not authorized to update job types belonging to another store.");
      return res.redirect("/job-types");
    }

    const name = String(req.body.name || "").trim();
    if (!name) {
      if (req.file) safeUnlinkJobTypeImage(req.file.filename);
      req.flash("error", "Job Type name is required.");
      return res.redirect(`/job-types/edit/${jtId}`);
    }

    const storeRows = await mySqlQury(
      "SELECT id, store_id, parent_id FROM tbl_job_types WHERE store_id = ?",
      [targetStoreId]
    );

    let parentId = null;
    if (req.body.parent_id !== undefined && String(req.body.parent_id).trim() !== "") {
      const parsedParent = Number(req.body.parent_id);
      const descendants = collectDescendantIds(storeRows, jtId);
      if (
        !Number.isInteger(parsedParent) ||
        parsedParent <= 0 ||
        parsedParent === jtId ||
        descendants.has(parsedParent)
      ) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Invalid parent selection: a job type cannot be a child of itself or its sub-types.");
        return res.redirect(`/job-types/edit/${jtId}`);
      }
      const sameStoreParent = storeRows.some((r) => Number(r.id) === parsedParent);
      if (!sameStoreParent) {
        if (req.file) safeUnlinkJobTypeImage(req.file.filename);
        req.flash("error", "Selected parent job type must belong to the same store.");
        return res.redirect(`/job-types/edit/${jtId}`);
      }
      parentId = parsedParent;
    }

    const description = req.body.description !== undefined ? String(req.body.description).trim() : null;
    const status = normalizeStatus(req.body.status);

    let nextImage = existing.image || null;
    const removeImage = String(req.body.remove_image || "") === "1";

    if (req.file) {
      if (existing.image) safeUnlinkJobTypeImage(existing.image);
      nextImage = req.file.filename;
    } else if (removeImage) {
      if (existing.image) safeUnlinkJobTypeImage(existing.image);
      nextImage = null;
    }

    await mySqlQury(
      `UPDATE tbl_job_types
       SET parent_id = ?, name = ?, description = ?, image = ?, status = ?
       WHERE id = ? AND store_id = ?`,
      [parentId, name, description || null, nextImage, status, jtId, targetStoreId]
    );

    req.flash("success", `Job Type "${name}" updated successfully!`);
    return res.redirect(perms.ismulty ? `/job-types?store_id=${targetStoreId}` : "/job-types");
  } catch (error) {
    if (req.file) safeUnlinkJobTypeImage(req.file.filename);
    console.error("Error in POST /job-types/edit/:id:", error);
    req.flash("error", "Failed to update Job Type.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// POST /job-types/status/:id — AJAX Active/Inactive Toggle
// =====================================================================
router.post("/status/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      return res.status(403).json({ success: false, message: "Demo mode write disabled." });
    }

    const perms = await resolvePermissions(req);
    if (!perms.canEdit) {
      return res.status(403).json({ success: false, message: "Not authorized to update status." });
    }

    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid job type ID." });
    }

    const existing = await mySqlQury(
      "SELECT id, store_id FROM tbl_job_types WHERE id = ? LIMIT 1",
      [jtId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: "Job Type not found." });
    }

    if (!perms.ismulty && Number(existing[0].store_id) !== perms.assignedStoreId) {
      return res.status(403).json({ success: false, message: "Not authorized to modify another store's job type." });
    }

    const status = normalizeStatus(req.body.status);
    await mySqlQury(
      "UPDATE tbl_job_types SET status = ? WHERE id = ?",
      [status, jtId]
    );

    return res.status(200).json({ success: true, id: jtId, status });
  } catch (error) {
    console.error("Error in POST /job-types/status/:id:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
});

// =====================================================================
// POST /job-types/delete/:id — Store-Scoped Cascade Delete
// =====================================================================
router.post("/delete/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/job-types");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canDelete) {
      req.flash("error", "You are not authorized to delete Job Types.");
      return res.redirect("/job-types");
    }

    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      req.flash("error", "Invalid Job Type ID.");
      return res.redirect("/job-types");
    }

    const targetRows = await mySqlQury(
      "SELECT id, store_id, name FROM tbl_job_types WHERE id = ? LIMIT 1",
      [jtId]
    );
    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Job Type not found.");
      return res.redirect("/job-types");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to delete job types belonging to another store.");
      return res.redirect("/job-types");
    }

    const storeRows = await mySqlQury(
      "SELECT id, parent_id, image FROM tbl_job_types WHERE store_id = ?",
      [targetStoreId]
    );

    // Collect self + all descendants so uploaded image files are also removed
    const descendantIds = collectDescendantIds(storeRows, jtId);
    const idsToClean = new Set([jtId, ...descendantIds]);

    for (const r of storeRows) {
      if (idsToClean.has(Number(r.id)) && r.image) {
        safeUnlinkJobTypeImage(r.image);
      }
    }

    // ON DELETE CASCADE removes all child & descendant rows atomically
    await mySqlQury("DELETE FROM tbl_job_types WHERE id = ? AND store_id = ?", [jtId, targetStoreId]);

    const subDeleted = descendantIds.size;
    const msg =
      subDeleted > 0
        ? `Deleted "${target.name}" along with ${subDeleted} ${subDeleted === 1 ? "sub-type" : "sub-types"}.`
        : `Job Type "${target.name}" deleted successfully.`;

    req.flash("success", msg);
    return res.redirect(req.get("Referrer") || "/job-types");
  } catch (error) {
    console.error("Error in POST /job-types/delete/:id:", error);
    req.flash("error", "Failed to delete Job Type.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// GET /job-types/:id/prices — Item & Price Configuration Page
// =====================================================================
router.get("/:id/prices", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canRead) {
      req.flash("error", "You are not authorized to access Job Type Item Prices.");
      return res.redirect("/job-types");
    }

    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      req.flash("error", "Invalid Job Type ID.");
      return res.redirect("/job-types");
    }

    const targetRows = await mySqlQury(
      `SELECT jt.id, jt.store_id, jt.parent_id, jt.name, jt.description, jt.image, jt.status,
              COALESCE(s.name, '') AS store_name
       FROM tbl_job_types jt
       LEFT JOIN tbl_store s ON jt.store_id = s.id
       WHERE jt.id = ? LIMIT 1`,
      [jtId]
    );

    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Job Type not found.");
      return res.redirect("/job-types");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to configure prices for another store's job type.");
      return res.redirect("/job-types");
    }

    const [storeJobTypes, activeServices, savedPrices, masterShop] = await Promise.all([
      mySqlQury(
        "SELECT id, parent_id, name FROM tbl_job_types WHERE store_id = ?",
        [targetStoreId]
      ),
      mySqlQury(
        `SELECT id, name, image, no_of_items, sequence_no, item_code
         FROM tbl_services
         WHERE store_ID = ? AND status = '0'
         ORDER BY sequence_no ASC, name ASC, id ASC`,
        [String(targetStoreId)]
      ),
      mySqlQury(
        "SELECT service_id, price FROM tbl_job_item_prices WHERE job_type_id = ? AND price > 0",
        [jtId]
      ),
      mySqlQury("SELECT currency_symbol, currency_placement FROM tbl_master_shop LIMIT 1"),
    ]);

    const breadcrumb = buildJobTypeBreadcrumb(storeJobTypes, jtId);
    const savedMap = new Map();
    for (const row of savedPrices || []) {
      const numeric = Number(row.price);
      if (Number.isFinite(numeric) && numeric > 0) {
        savedMap.set(Number(row.service_id), numeric);
      }
    }

    let pricedCount = 0;
    const items = (activeServices || []).map((svc) => {
      const svcId = Number(svc.id);
      const savedPrice = savedMap.has(svcId) ? savedMap.get(svcId) : 0;
      const isPriced = savedPrice > 0;
      if (isPriced) pricedCount++;
      return {
        id: svcId,
        name: svc.name || "",
        item_code: svc.item_code || "",
        sequence_no: Number(svc.sequence_no) || 0,
        no_of_items: parseInt(svc.no_of_items, 10) > 0 ? parseInt(svc.no_of_items, 10) : 1,
        image_url: resolvePosServiceImageUrl(svc.image, "small"),
        price: isPriced ? savedPrice.toFixed(2) : "0.00",
        isPriced,
      };
    });

    const m0 = masterShop && masterShop.length > 0 ? masterShop[0] : {};
    const currencySymbol = m0.currency_symbol ? String(m0.currency_symbol) : "$";
    const currencyPlacement = Number(m0.currency_placement) || 0;
    const backUrl = perms.ismulty ? `/job-types?store_id=${targetStoreId}` : "/job-types";

    return res.render("job_type_prices", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      jobType: {
        id: Number(target.id),
        store_id: targetStoreId,
        store_name: target.store_name || perms.assignedStoreName,
        name: target.name || "",
        description: target.description || "",
        status: normalizeStatus(target.status),
      },
      breadcrumb,
      items,
      stats: {
        total: items.length,
        priced: pricedCount,
        unpriced: Math.max(0, items.length - pricedCount),
      },
      currencySymbol,
      currencyPlacement,
      canSave: Boolean(perms.canEdit || perms.canWrite),
      backUrl,
    });
  } catch (error) {
    console.error("Error in GET /job-types/:id/prices:", error);
    req.flash("error", "Failed to load Item & Price configuration page.");
    return res.redirect("/job-types");
  }
});

// =====================================================================
// POST /job-types/:id/prices — Save Positive Item Prices & Delete Zeroes
// =====================================================================
router.post("/:id/prices", auth, async (req, res) => {
  let poolConn = null;
  try {
    const jtId = Number(req.params.id);
    if (!Number.isInteger(jtId) || jtId <= 0) {
      req.flash("error", "Invalid Job Type ID.");
      return res.redirect("/job-types");
    }

    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect(`/job-types/${jtId}/prices`);
    }

    const perms = await resolvePermissions(req);
    if (!perms.canEdit && !perms.canWrite) {
      req.flash("error", "You are not authorized to update Job Type Item Prices.");
      return res.redirect(`/job-types/${jtId}/prices`);
    }

    const targetRows = await mySqlQury(
      "SELECT id, store_id, name FROM tbl_job_types WHERE id = ? LIMIT 1",
      [jtId]
    );
    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Job Type not found.");
      return res.redirect("/job-types");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to update prices for another store's job type.");
      return res.redirect("/job-types");
    }

    const activeServiceRows = await mySqlQury(
      "SELECT id FROM tbl_services WHERE store_ID = ? AND status = '0'",
      [String(targetStoreId)]
    );
    const validServiceIds = new Set((activeServiceRows || []).map((r) => Number(r.id)));

    const { positiveRows, zeroedServiceIds } = parsePriceEntries(
      req.body,
      validServiceIds,
      targetStoreId,
      jtId
    );

    poolConn = await conn.promise().getConnection();
    await poolConn.beginTransaction();

    let deletedCount = 0;
    if (zeroedServiceIds.length > 0) {
      const [delResult] = await poolConn.query(
        "DELETE FROM tbl_job_item_prices WHERE job_type_id = ? AND service_id IN (?)",
        [jtId, zeroedServiceIds]
      );
      deletedCount = delResult && delResult.affectedRows ? Number(delResult.affectedRows) : 0;
    }

    if (positiveRows.length > 0) {
      await poolConn.query(
        `INSERT INTO tbl_job_item_prices (store_id, job_type_id, service_id, price)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           store_id = VALUES(store_id),
           price = VALUES(price),
           updated_at = CURRENT_TIMESTAMP`,
        [positiveRows]
      );
    }

    await poolConn.commit();

    const savedCount = positiveRows.length;
    let msg = `Saved ${savedCount} priced ${savedCount === 1 ? "item" : "items"} for "${target.name}".`;
    if (deletedCount > 0) {
      msg += ` Removed ${deletedCount} zero-priced ${deletedCount === 1 ? "item" : "items"}.`;
    }

    req.flash("success", msg);
    return res.redirect(`/job-types/${jtId}/prices`);
  } catch (error) {
    if (poolConn) {
      try {
        await poolConn.rollback();
      } catch (rbErr) {
        console.error("Rollback error in POST /job-types/:id/prices:", rbErr);
      }
    }
    console.error("Error in POST /job-types/:id/prices:", error);
    req.flash("error", "Failed to save Job Type Item Prices.");
    const fallbackId = Number(req.params.id);
    return res.redirect(Number.isInteger(fallbackId) && fallbackId > 0 ? `/job-types/${fallbackId}/prices` : "/job-types");
  } finally {
    if (poolConn) {
      poolConn.release();
    }
  }
});

router._helpers = {
  normalizeStatus,
  collectDescendantIds,
  buildJobTypeTree,
  flattenTreeOptions,
  buildJobTypeBreadcrumb,
  parsePriceEntries,
  resolvePermissions,
};

module.exports = router;
