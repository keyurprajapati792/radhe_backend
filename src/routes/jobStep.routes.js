import express from "express";

import JobStepController from "../controllers/jobStep.controller.js";

const router = express.Router();

router.get("/:jobId", JobStepController.getJobSteps);
router.put("/job-card", JobStepController.updateJobCard);

export default router;
