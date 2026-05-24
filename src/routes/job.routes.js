import express from "express";

import JobController from "../controllers/job.controller.js";

const router = express.Router();

router.post("/", JobController.createJob);

router.get("/", JobController.getJobs);

router.get("/:id", JobController.getJobById);

export default router;
