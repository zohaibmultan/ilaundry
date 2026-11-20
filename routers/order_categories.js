const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const auth = require("../middelwer/auth");
const access = require("../middelwer/access");
const { mySqlQury } = require("../middelwer/db");

// Dedicated upload directory for order category images
const UPLOAD_SUBDIR = path.join(__dirname, "../public/uploads/order-categories");
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
      .basename(file.originalname || "category", ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 60);
    cb(null, `${Date.now()}-${base}${ext}`);
  },
});

const uploadCategoryImage = multer({
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
  uploadCategoryImage.single("image")(req, res, (err) => {
    if (err) {
      req.flash("error", err.message || "Invalid image upload");
      return res.redirect(req.get("Referrer") || "/order-categories");
    }
    return next();
  });
}

function safeUnlinkCategoryImage(filename) {
  if (!filename || typeof filename !== "string") return;
  const safeName = path.basename(filename.trim());
  if (!safeName) return;
  const fullPath = path.join(UPLOAD_SUBDIR, safeName);
  try {
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      fs.unlinkSync(fullPath);
    }
  } catch (err) {
    console.warn(`[OrderCategories] Could not delete image ${safeName}:`, err.message);
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

function buildCategoryTree(rows) {
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
      image_url: r.image ? `/uploads/order-categories/${encodeURIComponent(path.basename(r.image))}` : "",
      status: normalizeStatus(r.status),
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
// GET /order-categories — Tree List View (Store-Scoped)
// =====================================================================
router.get("/", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canRead) {
      req.flash("error", "You are not authorized to access Order Categories.");
      return res.redirect(req.get("Referrer") || "/index");
    }

    let selectedStoreId = "all";
    let querySql = `
      SELECT oc.id, oc.store_id, oc.parent_id, oc.name, oc.description, oc.image, oc.status,
             COALESCE(s.name, '') AS store_name
      FROM tbl_order_categories oc
      LEFT JOIN tbl_store s ON oc.store_id = s.id
    `;
    const params = [];

    if (!perms.ismulty) {
      selectedStoreId = String(perms.assignedStoreId);
      querySql += " WHERE oc.store_id = ?";
      params.push(perms.assignedStoreId);
    } else if (req.query.store_id && String(req.query.store_id).trim() !== "" && String(req.query.store_id) !== "all") {
      const parsedFilterStore = Number(req.query.store_id);
      if (Number.isInteger(parsedFilterStore) && parsedFilterStore > 0) {
        selectedStoreId = String(parsedFilterStore);
        querySql += " WHERE oc.store_id = ?";
        params.push(parsedFilterStore);
      }
    }

    querySql += " ORDER BY oc.store_id ASC, oc.name ASC, oc.id ASC";
    const rows = await mySqlQury(querySql, params);

    const categoryTree = buildCategoryTree(rows);
    const totalCount = rows.length;
    const rootCount = categoryTree.length;
    const subCount = Math.max(0, totalCount - rootCount);
    const activeCount = rows.filter((r) => normalizeStatus(r.status) === "active").length;
    const inactiveCount = totalCount - activeCount;

    return res.render("order_categories", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      selectedStoreId,
      assignedStoreId: perms.assignedStoreId,
      assignedStoreName: perms.assignedStoreName,
      categoryTree,
      stats: {
        total: totalCount,
        roots: rootCount,
        subcategories: subCount,
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
    console.error("Error in GET /order-categories:", error);
    req.flash("error", "Failed to load Order Categories.");
    return res.redirect("/index");
  }
});

// =====================================================================
// GET /order-categories/parents-by-store/:store_id — Dynamic Parent Options API
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
       FROM tbl_order_categories
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

    const tree = buildCategoryTree(rows);
    const options = flattenTreeOptions(tree, excludeIds);

    return res.status(200).json({ success: true, store_id: targetStoreId, options });
  } catch (error) {
    console.error("Error in GET /order-categories/parents-by-store/:store_id:", error);
    return res.status(500).json({ success: false, message: "Failed to load parent categories.", options: [] });
  }
});

// =====================================================================
// GET /order-categories/create — Dedicated Create Page (Store-Scoped)
// =====================================================================
router.get("/create", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canWrite) {
      req.flash("error", "You are not authorized to create Order Categories.");
      return res.redirect("/order-categories");
    }

    let targetStoreId = perms.assignedStoreId;
    let validPreselectedParent = null;

    // If ?parent_id= is provided, detect its store_id (enforcing ownership for non-master)
    if (req.query.parent_id) {
      const parsedParent = Number(req.query.parent_id);
      if (Number.isInteger(parsedParent) && parsedParent > 0) {
        const parentRows = await mySqlQury(
          "SELECT id, store_id FROM tbl_order_categories WHERE id = ? LIMIT 1",
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
       FROM tbl_order_categories
       WHERE store_id = ?
       ORDER BY name ASC, id ASC`,
      [targetStoreId]
    );
    const tree = buildCategoryTree(rows);
    const parentOptions = flattenTreeOptions(tree);

    const targetStoreObj = perms.storeList.find((s) => Number(s.id) === targetStoreId);

    return res.render("order_category_form", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      mode: "create",
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      category: {
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
    console.error("Error in GET /order-categories/create:", error);
    req.flash("error", "Failed to load Create Order Category page.");
    return res.redirect("/order-categories");
  }
});

// =====================================================================
// POST /order-categories/create — Persist New Store-Scoped Category
// =====================================================================
router.post("/create", auth, handleImageUpload, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/order-categories");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canWrite) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "You are not authorized to create Order Categories.");
      return res.redirect("/order-categories");
    }

    // Determine target store_id (non-master strictly locked to assignedStoreId)
    let targetStoreId = perms.assignedStoreId;
    if (perms.ismulty) {
      const submittedStore = Number(req.body.store_id);
      if (!Number.isInteger(submittedStore) || submittedStore <= 0) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Please select a valid store.");
        return res.redirect(req.get("Referrer") || "/order-categories/create");
      }
      const storeExists = await mySqlQury(
        "SELECT id FROM tbl_store WHERE id = ? AND delete_flage = '0' LIMIT 1",
        [submittedStore]
      );
      if (!storeExists || storeExists.length === 0) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Selected store does not exist.");
        return res.redirect(req.get("Referrer") || "/order-categories/create");
      }
      targetStoreId = submittedStore;
    }

    const name = String(req.body.name || "").trim();
    if (!name) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "Category name is required.");
      return res.redirect(req.get("Referrer") || "/order-categories/create");
    }

    let parentId = null;
    if (req.body.parent_id !== undefined && String(req.body.parent_id).trim() !== "") {
      const parsedParent = Number(req.body.parent_id);
      if (!Number.isInteger(parsedParent) || parsedParent <= 0) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Invalid parent category selected.");
        return res.redirect(req.get("Referrer") || "/order-categories/create");
      }
      const parentCheck = await mySqlQury(
        "SELECT id, store_id FROM tbl_order_categories WHERE id = ? LIMIT 1",
        [parsedParent]
      );
      if (!parentCheck || parentCheck.length === 0) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Selected parent category does not exist.");
        return res.redirect(req.get("Referrer") || "/order-categories/create");
      }
      if (Number(parentCheck[0].store_id) !== Number(targetStoreId)) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Parent category must belong to the same store.");
        return res.redirect(req.get("Referrer") || "/order-categories/create");
      }
      parentId = parsedParent;
    }

    const description = req.body.description !== undefined ? String(req.body.description).trim() : null;
    const status = normalizeStatus(req.body.status);
    const image = req.file ? req.file.filename : null;

    await mySqlQury(
      `INSERT INTO tbl_order_categories (store_id, parent_id, name, description, image, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [targetStoreId, parentId, name, description || null, image, status]
    );

    req.flash("success", `Order Category "${name}" created successfully!`);
    return res.redirect(perms.ismulty ? `/order-categories?store_id=${targetStoreId}` : "/order-categories");
  } catch (error) {
    if (req.file) safeUnlinkCategoryImage(req.file.filename);
    console.error("Error in POST /order-categories/create:", error);
    req.flash("error", "Failed to create Order Category.");
    return res.redirect("/order-categories");
  }
});

// =====================================================================
// GET /order-categories/edit/:id — Dedicated Edit Page (Store-Scoped)
// =====================================================================
router.get("/edit/:id", auth, async (req, res) => {
  try {
    const perms = await resolvePermissions(req);
    if (!perms.canEdit) {
      req.flash("error", "You are not authorized to edit Order Categories.");
      return res.redirect("/order-categories");
    }

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      req.flash("error", "Invalid Order Category ID.");
      return res.redirect("/order-categories");
    }

    const targetRows = await mySqlQury(
      `SELECT oc.id, oc.store_id, oc.parent_id, oc.name, oc.description, oc.image, oc.status,
              COALESCE(s.name, '') AS store_name
       FROM tbl_order_categories oc
       LEFT JOIN tbl_store s ON oc.store_id = s.id
       WHERE oc.id = ? LIMIT 1`,
      [catId]
    );

    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Order Category not found.");
      return res.redirect("/order-categories");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to edit categories belonging to another store.");
      return res.redirect("/order-categories");
    }

    // Load only categories belonging to the SAME store
    const storeRows = await mySqlQury(
      `SELECT id, store_id, parent_id, name, description, image, status
       FROM tbl_order_categories
       WHERE store_id = ?
       ORDER BY name ASC, id ASC`,
      [targetStoreId]
    );

    // Exclude self and all descendants to prevent circular hierarchy
    const excludeIds = collectDescendantIds(storeRows, catId);
    excludeIds.add(catId);

    const tree = buildCategoryTree(storeRows);
    const parentOptions = flattenTreeOptions(tree, excludeIds);

    return res.render("order_category_form", {
      accessdata: perms.accessdata,
      language: req.language_data,
      language_name: req.language_name,
      mode: "edit",
      ismulty: perms.ismulty,
      storeList: perms.storeList,
      category: {
        id: Number(target.id),
        store_id: targetStoreId,
        store_name: target.store_name || perms.assignedStoreName,
        parent_id: target.parent_id !== null && target.parent_id !== undefined ? Number(target.parent_id) : null,
        name: target.name || "",
        description: target.description || "",
        image: target.image || "",
        image_url: target.image
          ? `/uploads/order-categories/${encodeURIComponent(path.basename(target.image))}`
          : "",
        status: normalizeStatus(target.status),
      },
      parentOptions,
    });
  } catch (error) {
    console.error("Error in GET /order-categories/edit/:id:", error);
    req.flash("error", "Failed to load Edit Order Category page.");
    return res.redirect("/order-categories");
  }
});

// =====================================================================
// POST /order-categories/edit/:id — Update Category (Store-Scoped)
// =====================================================================
router.post("/edit/:id", auth, handleImageUpload, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/order-categories");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canEdit) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "You are not authorized to edit Order Categories.");
      return res.redirect("/order-categories");
    }

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "Invalid Order Category ID.");
      return res.redirect("/order-categories");
    }

    const existingRows = await mySqlQury(
      "SELECT id, store_id, parent_id, name, description, image, status FROM tbl_order_categories WHERE id = ? LIMIT 1",
      [catId]
    );
    if (!existingRows || existingRows.length === 0) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "Order Category not found.");
      return res.redirect("/order-categories");
    }

    const existing = existingRows[0];
    const targetStoreId = Number(existing.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "You are not authorized to update categories belonging to another store.");
      return res.redirect("/order-categories");
    }

    const name = String(req.body.name || "").trim();
    if (!name) {
      if (req.file) safeUnlinkCategoryImage(req.file.filename);
      req.flash("error", "Category name is required.");
      return res.redirect(`/order-categories/edit/${catId}`);
    }

    const storeRows = await mySqlQury(
      "SELECT id, store_id, parent_id FROM tbl_order_categories WHERE store_id = ?",
      [targetStoreId]
    );

    let parentId = null;
    if (req.body.parent_id !== undefined && String(req.body.parent_id).trim() !== "") {
      const parsedParent = Number(req.body.parent_id);
      const descendants = collectDescendantIds(storeRows, catId);
      if (
        !Number.isInteger(parsedParent) ||
        parsedParent <= 0 ||
        parsedParent === catId ||
        descendants.has(parsedParent)
      ) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Invalid parent selection: a category cannot be a child of itself or its subcategories.");
        return res.redirect(`/order-categories/edit/${catId}`);
      }
      const sameStoreParent = storeRows.some((r) => Number(r.id) === parsedParent);
      if (!sameStoreParent) {
        if (req.file) safeUnlinkCategoryImage(req.file.filename);
        req.flash("error", "Selected parent category must belong to the same store.");
        return res.redirect(`/order-categories/edit/${catId}`);
      }
      parentId = parsedParent;
    }

    const description = req.body.description !== undefined ? String(req.body.description).trim() : null;
    const status = normalizeStatus(req.body.status);

    let nextImage = existing.image || null;
    const removeImage = String(req.body.remove_image || "") === "1";

    if (req.file) {
      if (existing.image) safeUnlinkCategoryImage(existing.image);
      nextImage = req.file.filename;
    } else if (removeImage) {
      if (existing.image) safeUnlinkCategoryImage(existing.image);
      nextImage = null;
    }

    await mySqlQury(
      `UPDATE tbl_order_categories
       SET parent_id = ?, name = ?, description = ?, image = ?, status = ?
       WHERE id = ? AND store_id = ?`,
      [parentId, name, description || null, nextImage, status, catId, targetStoreId]
    );

    req.flash("success", `Order Category "${name}" updated successfully!`);
    return res.redirect(perms.ismulty ? `/order-categories?store_id=${targetStoreId}` : "/order-categories");
  } catch (error) {
    if (req.file) safeUnlinkCategoryImage(req.file.filename);
    console.error("Error in POST /order-categories/edit/:id:", error);
    req.flash("error", "Failed to update Order Category.");
    return res.redirect("/order-categories");
  }
});

// =====================================================================
// POST /order-categories/status/:id — AJAX Active/Inactive Toggle
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

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      return res.status(400).json({ success: false, message: "Invalid category ID." });
    }

    const existing = await mySqlQury(
      "SELECT id, store_id FROM tbl_order_categories WHERE id = ? LIMIT 1",
      [catId]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ success: false, message: "Order Category not found." });
    }

    if (!perms.ismulty && Number(existing[0].store_id) !== perms.assignedStoreId) {
      return res.status(403).json({ success: false, message: "Not authorized to modify another store's category." });
    }

    const status = normalizeStatus(req.body.status);
    await mySqlQury(
      "UPDATE tbl_order_categories SET status = ? WHERE id = ?",
      [status, catId]
    );

    return res.status(200).json({ success: true, id: catId, status });
  } catch (error) {
    console.error("Error in POST /order-categories/status/:id:", error);
    return res.status(500).json({ success: false, message: "Failed to update status." });
  }
});

// =====================================================================
// POST /order-categories/delete/:id — Store-Scoped Cascade Delete
// =====================================================================
router.post("/delete/:id", auth, async (req, res) => {
  try {
    if (process.env.DISABLE_DB_WRITE === "true") {
      req.flash("error", "For demo purpose we disabled crud operations!!");
      return res.redirect("/order-categories");
    }

    const perms = await resolvePermissions(req);
    if (!perms.canDelete) {
      req.flash("error", "You are not authorized to delete Order Categories.");
      return res.redirect("/order-categories");
    }

    const catId = Number(req.params.id);
    if (!Number.isInteger(catId) || catId <= 0) {
      req.flash("error", "Invalid Order Category ID.");
      return res.redirect("/order-categories");
    }

    const targetRows = await mySqlQury(
      "SELECT id, store_id, name FROM tbl_order_categories WHERE id = ? LIMIT 1",
      [catId]
    );
    if (!targetRows || targetRows.length === 0) {
      req.flash("error", "Order Category not found.");
      return res.redirect("/order-categories");
    }

    const target = targetRows[0];
    const targetStoreId = Number(target.store_id);

    if (!perms.ismulty && targetStoreId !== perms.assignedStoreId) {
      req.flash("error", "You are not authorized to delete categories belonging to another store.");
      return res.redirect("/order-categories");
    }

    const storeRows = await mySqlQury(
      "SELECT id, parent_id, image FROM tbl_order_categories WHERE store_id = ?",
      [targetStoreId]
    );

    // Collect self + all descendants so uploaded image files are also removed
    const descendantIds = collectDescendantIds(storeRows, catId);
    const idsToClean = new Set([catId, ...descendantIds]);

    for (const r of storeRows) {
      if (idsToClean.has(Number(r.id)) && r.image) {
        safeUnlinkCategoryImage(r.image);
      }
    }

    // ON DELETE CASCADE removes all child & descendant rows atomically
    await mySqlQury("DELETE FROM tbl_order_categories WHERE id = ? AND store_id = ?", [catId, targetStoreId]);

    const subDeleted = descendantIds.size;
    const msg =
      subDeleted > 0
        ? `Deleted "${target.name}" along with ${subDeleted} ${subDeleted === 1 ? "subcategory" : "subcategories"}.`
        : `Order Category "${target.name}" deleted successfully.`;

    req.flash("success", msg);
    return res.redirect(req.get("Referrer") || "/order-categories");
  } catch (error) {
    console.error("Error in POST /order-categories/delete/:id:", error);
    req.flash("error", "Failed to delete Order Category.");
    return res.redirect("/order-categories");
  }
});

router._helpers = {
  normalizeStatus,
  collectDescendantIds,
  buildCategoryTree,
  flattenTreeOptions,
  resolvePermissions,
};

module.exports = router;
