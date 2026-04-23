const express        = require("express");
const router         = express.Router();
const dateController = require("../controllers/dateController");
const { protect }    = require("../middleware/authMiddleware");

router.post("/request",                  protect, dateController.sendDateRequest);
router.post("/:scheduleId/respond",      protect, dateController.respondToDate);
router.get("/notifications/:userId",     protect, dateController.getNotifications);
router.patch("/notifications/:userId/read", protect, dateController.markNotificationsRead);
router.get("/survey/status/:scheduleId", protect, dateController.getPostDateSurveyStatus);
router.post("/survey",                   protect, dateController.submitPostDateSurvey);
router.post("/survey-check",             dateController.checkAndSendSurveys);

module.exports = router;