import express from "express";

import JobController from "../controllers/job.controller.js";

const router = express.Router();

router.post("/", JobController.createJob);
router.get("/:id/planning", JobController.getJobPlanningData);
router.get("/:id", JobController.getJobById);
router.patch("/:id/status", JobController.updateJobStatus);
router.get("/", JobController.getJobs);

export default router;
