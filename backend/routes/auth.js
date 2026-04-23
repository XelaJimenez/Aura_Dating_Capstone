// routes/auth.js
const express        = require("express");
const router         = express.Router();
const authController = require("../controllers/authController");
const { protect }    = require("../middleware/authMiddleware"); // ← ADDED

router.post("/signup", authController.signup);
router.post("/login",  authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.get("/me",      protect, authController.getMe); // ← ADDED — protected route

module.exports = router;