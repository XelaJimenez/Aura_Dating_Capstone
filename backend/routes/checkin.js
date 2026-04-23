const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { submitCheckin, getCheckinSummary } = require("../controllers/checkinController");

router.post("/submit", protect, submitCheckin);
router.get("/summary/:user_id", protect, getCheckinSummary);

module.exports = router;
