
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const crypto = require("crypto");
const path = require("path");

const app = express();

// CORS: Allow VS Code Live Server on port 5500
app.use(
  cors({
    origin: [
      "http://127.0.0.1:5500",
      "http://localhost:5500"
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "1mb" }));

// Serve frontend files when using the backend URL
app.use(express.static(path.join(__dirname, "..")));

const PORT = process.env.PORT || 5000;

// Complaint database structure
const complaintSchema = new mongoose.Schema(
  {
    reference: {
      type: String,
      unique: true,
      required: true
    },
    category: {
      type: String,
      required: true,
      maxlength: 100
    },
    description: {
      type: String,
      required: true,
      maxlength: 3000
    },
    contactPreference: {
      type: String,
      enum: ["phone", "email", "none"],
      default: "none"
    },
    status: {
      type: String,
      enum: ["Pending", "Under Review", "Resolved"],
      default: "Pending"
    },
    history: [
      {
        status: String,
        note: String,
        changedAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

const Complaint = mongoose.model("Complaint", complaintSchema);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "HealthGuard API is running"
  });
});

// Submit a complaint
app.post("/api/complaints", async (req, res) => {
  try {
    const { category, description, contactPreference } = req.body;

    if (
      typeof category !== "string" ||
      typeof description !== "string" ||
      !category.trim() ||
      !description.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Category and description are required."
      });
    }

    if (category.length > 100 || description.length > 3000) {
      return res.status(400).json({
        success: false,
        message: "Input is too long."
      });
    }

    const allowedContacts = ["phone", "email", "none"];
    const contact = contactPreference || "none";

    if (!allowedContacts.includes(contact)) {
      return res.status(400).json({
        success: false,
        message: "Invalid contact preference."
      });
    }

    const reference =
      "HG-" + crypto.randomBytes(5).toString("hex").toUpperCase();

    const complaint = await Complaint.create({
      reference,
      category: category.trim(),
      description: description.trim(),
      contactPreference: contact,
      status: "Pending",
      history: [
        {
          status: "Pending",
          note: "Complaint received by the system."
        }
      ]
    });

    return res.status(201).json({
      success: true,
      message: "Complaint saved successfully.",
      complaint: {
        reference: complaint.reference,
        category: complaint.category,
        description: complaint.description,
        status: complaint.status,
        history: complaint.history,
        createdAt: complaint.createdAt
      }
    });
  } catch (error) {
    console.error("Complaint save error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to save complaint. Please try again."
    });
  }
});

// List complaints
app.get("/api/complaints", async (req, res) => {
  try {
    const complaints = await Complaint.find()
      .select(
        "reference category description status history createdAt updatedAt"
      )
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      success: true,
      complaints
    });
  } catch (error) {
    console.error("GET /api/complaints error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load complaints."
    });
  }
});

// Fetch one complaint by reference ID
app.get("/api/complaints/:reference", async (req, res) => {
  try {
    const reference = req.params.reference.toUpperCase();

    const complaint = await Complaint.findOne({ reference })
      .select(
        "reference category description status history createdAt updatedAt"
      )
      .lean();

    if (!complaint) {
      return res.status(404).json({
        success: false,
        message: "Case not found."
      });
    }

    return res.json({
      success: true,
      complaint
    });
  } catch (error) {
    console.error("Fetch complaint error:", error.message);

    return res.status(500).json({
      success: false,
      message: "Unable to load case."
    });
  }
});

// Start server after MongoDB connects
async function startServer() {
  if (!process.env.MONGODB_URI) {
    console.error("Missing MONGODB_URI in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`HealthGuard API: http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

startServer();