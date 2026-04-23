const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { submitAppeal, listMyAppeals, getAppealEligibility } = require("../controllers/appealController");

router.get("/eligibility", protect, getAppealEligibility);
router.post("/", protect, submitAppeal);
router.get("/mine", protect, listMyAppeals);

module.exports = router;
