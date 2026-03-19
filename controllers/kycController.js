const { Kyc, Customer } = require("../models");

// ── Get All KYCs (admin) ─────────────────────────────────────
exports.getAllKycs = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where = {};
    if (status) where.status = status;

    const { count, rows: kycs } = await Kyc.findAndCountAll({
      where,
      attributes: [
        "id",
        "customerId",
        "doc",
        "docType",
        "imageType",
        "status",
        "createdAt",
        "updatedAt",
      ],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone", "nin"],
        },
      ],
      order: [["createdAt", "DESC"]],
      limit: Number(limit),
      offset,
    });

    res.status(200).json({
      success: true,
      total: count,
      page: Number(page),
      totalPages: Math.ceil(count / Number(limit)),
      data: kycs,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Single KYC (admin) ───────────────────────────────────
exports.getKyc = async (req, res) => {
  try {
    const { includeImageData = "false" } = req.query;

    const attributes =
      includeImageData === "true"
        ? [
            "id",
            "customerId",
            "doc",
            "docType",
            "image",
            "imageType",
            "status",
            "createdAt",
            "updatedAt",
          ]
        : [
            "id",
            "customerId",
            "doc",
            "docType",
            "imageType",
            "status",
            "createdAt",
            "updatedAt",
          ];

    const kyc = await Kyc.findByPk(req.params.id, {
      attributes,
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "email", "phone", "nin"],
        },
      ],
    });

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC not found" });
    }

    const kycData = kyc.toJSON();

    if (kycData.image) {
      kycData.imageBase64 = `data:${kycData.imageType || "image/jpeg"};base64,${kycData.image.toString("base64")}`;
      delete kycData.image;
    }

    res.status(200).json({ success: true, data: kycData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Approve KYC ──────────────────────────────────────────────
exports.approveKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id, {
      attributes: [
        "id",
        "customerId",
        "doc",
        "docType",
        "imageType",
        "status",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC not found" });
    }

    if (kyc.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "KYC is already approved" });
    }

    await kyc.update({ status: "approved" });
    await Customer.update(
      { kycStatus: "verified" },
      { where: { id: kyc.customerId } },
    );

    res
      .status(200)
      .json({ success: true, message: "KYC approved successfully", data: kyc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Reject KYC ───────────────────────────────────────────────
exports.rejectKyc = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id, {
      attributes: [
        "id",
        "customerId",
        "doc",
        "docType",
        "imageType",
        "status",
        "createdAt",
        "updatedAt",
      ],
    });

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC not found" });
    }

    if (kyc.status === "rejected") {
      return res
        .status(400)
        .json({ success: false, message: "KYC is already rejected" });
    }

    await kyc.update({ status: "rejected" });
    await Customer.update(
      { kycStatus: "rejected" },
      { where: { id: kyc.customerId } },
    );

    res.status(200).json({ success: true, message: "KYC rejected", data: kyc });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Customer's Own KYC ───────────────────────────────────
exports.getMyKyc = async (req, res) => {
  try {
    const { includeImageData = "false" } = req.query;

    const attributes =
      includeImageData === "true"
        ? [
            "id",
            "customerId",
            "doc",
            "docType",
            "image",
            "imageType",
            "status",
            "createdAt",
            "updatedAt",
          ]
        : [
            "id",
            "customerId",
            "doc",
            "docType",
            "imageType",
            "status",
            "createdAt",
            "updatedAt",
          ];

    const kyc = await Kyc.findOne({
      where: { customerId: req.user.id },
      attributes,
      order: [["createdAt", "DESC"]],
    });

    if (!kyc) {
      return res
        .status(404)
        .json({ success: false, message: "No KYC submission found" });
    }

    const kycData = kyc.toJSON();

    if (kycData.image) {
      kycData.imageBase64 = `data:${kycData.imageType || "image/jpeg"};base64,${kycData.image.toString("base64")}`;
      delete kycData.image;
    }

    res.status(200).json({ success: true, data: kycData });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Submit / Create KYC ──────────────────────────────────────
exports.submitKyc = async (req, res) => {
  try {
    const { docType } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "Image file is required" });
    }

    // Validate MIME type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Allowed: JPEG, PNG, WEBP, PDF",
      });
    }

    // Check for existing pending or approved KYC
    const existingKyc = await Kyc.findOne({
      where: { customerId: req.user.id, status: ["pending", "approved"] },
    });

    if (existingKyc) {
      return res.status(400).json({
        success: false,
        message:
          existingKyc.status === "approved"
            ? "Your KYC is already approved"
            : "You already have a pending KYC submission. Please wait for review or update it instead.",
      });
    }

    const kyc = await Kyc.create({
      customerId: req.user.id,
      image: req.file.buffer,
      imageType: req.file.mimetype,
      docType: docType || null,
      doc: req.file.originalname,
      status: "pending",
    });

    await Customer.update(
      { kycStatus: "pending" },
      { where: { id: req.user.id } },
    );

    const kycData = kyc.toJSON();
    delete kycData.image; // Never return raw buffer

    res.status(201).json({
      success: true,
      message: "KYC submitted successfully",
      data: kycData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Update / Re-submit KYC Image ─────────────────────────────
// Customers can only update a rejected KYC (not a pending/approved one)
exports.updateMyKyc = async (req, res) => {
  try {
    const { docType } = req.body;

    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "A new image file is required" });
    }

    // Validate MIME type
    const allowedTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "application/pdf",
    ];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid file type. Allowed: JPEG, PNG, WEBP, PDF",
      });
    }

    const kyc = await Kyc.findOne({
      where: { customerId: req.user.id },
      order: [["createdAt", "DESC"]],
    });

    if (!kyc) {
      return res
        .status(404)
        .json({ success: false, message: "No KYC submission found to update" });
    }

    if (kyc.status === "approved") {
      return res
        .status(400)
        .json({ success: false, message: "Approved KYC cannot be modified" });
    }

    if (kyc.status === "pending") {
      return res.status(400).json({
        success: false,
        message: "Your KYC is currently under review and cannot be edited",
      });
    }

    // status === "rejected" → allow re-submission
    await kyc.update({
      image: req.file.buffer,
      imageType: req.file.mimetype,
      doc: req.file.originalname,
      docType: docType || kyc.docType,
      status: "pending", // Reset to pending for re-review
    });

    await Customer.update(
      { kycStatus: "pending" },
      { where: { id: req.user.id } },
    );

    const kycData = kyc.toJSON();
    delete kycData.image;

    res.status(200).json({
      success: true,
      message: "KYC updated and resubmitted for review",
      data: kycData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get KYC Image (admin) ────────────────────────────────────
exports.getKycImage = async (req, res) => {
  try {
    const kyc = await Kyc.findByPk(req.params.id, {
      attributes: ["id", "image", "imageType", "customerId"],
    });

    if (!kyc) {
      return res.status(404).json({ success: false, message: "KYC not found" });
    }

    if (!kyc.image) {
      return res
        .status(404)
        .json({ success: false, message: "No image found for this KYC" });
    }

    res.setHeader("Content-Type", kyc.imageType || "image/jpeg");
    res.setHeader("Content-Length", kyc.image.length);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="kyc-${kyc.id}.${getFileExtension(kyc.imageType)}"`,
    );
    res.send(kyc.image);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Get Customer's Own KYC Image ─────────────────────────────
exports.getMyKycImage = async (req, res) => {
  try {
    const kyc = await Kyc.findOne({
      where: { customerId: req.user.id },
      attributes: ["id", "image", "imageType"],
      order: [["createdAt", "DESC"]],
    });

    if (!kyc) {
      return res
        .status(404)
        .json({ success: false, message: "No KYC submission found" });
    }

    if (!kyc.image) {
      return res
        .status(404)
        .json({ success: false, message: "No image found for your KYC" });
    }

    res.setHeader("Content-Type", kyc.imageType || "image/jpeg");
    res.setHeader("Content-Length", kyc.image.length);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="my-kyc.${getFileExtension(kyc.imageType)}"`,
    );
    res.send(kyc.image);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ── Helper ───────────────────────────────────────────────────
const getFileExtension = (mimeType) => {
  const map = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/bmp": "bmp",
    "application/pdf": "pdf",
  };
  return map[mimeType] || "jpg";
};
