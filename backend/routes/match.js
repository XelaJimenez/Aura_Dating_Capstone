const express         = require("express");
const router          = express.Router();
const matchController = require("../controllers/matchController");
const { protect }     = require("../middleware/authMiddleware");

router.get("/all",             protect, matchController.getAllCandidates);
router.get("/:userId/mutual",  protect, matchController.getMutualMatches);
router.get("/:userId",         protect, matchController.getMatches);
router.post("/:userId/reject", protect, matchController.rejectUser);
router.post("/:userId/like",   protect, matchController.likeUser);

module.exports = router;