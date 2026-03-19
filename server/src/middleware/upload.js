import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure upload directories exist
const uploadDir = path.join(__dirname, "../../public/uploads");
const dirs = ["profiles", "messages", "statuses"].map(d => path.join(uploadDir, d));
dirs.forEach(d => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine folder based on route
    const folder = req.uploadFolder || "messages";
    cb(null, path.join(uploadDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, uniqueSuffix + ext);
  },
});

// File filter — images only
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
});

// Helper to delete a file from public/uploads given its URL path
export const deleteUploadedFile = (fileUrl) => {
  if (!fileUrl) return;
  try {
    // fileUrl looks like "/uploads/profiles/123456.jpg"
    const filePath = path.join(__dirname, "../../public", fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Deleted file:", filePath);
    }
  } catch (err) {
    console.error("Error deleting file:", err.message);
  }
};

// Middleware setters for different upload folders
export const uploadProfile = (req, res, next) => { req.uploadFolder = "profiles"; next(); };
export const uploadMessage = (req, res, next) => { req.uploadFolder = "messages"; next(); };
export const uploadStatus = (req, res, next) => { req.uploadFolder = "statuses"; next(); };

export default upload;
