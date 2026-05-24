import express from "express";

import SchedulerController from "../controllers/scheduler.controller.js";

const router = express.Router();

router.get("/job-step/:jobStepId", SchedulerController.getSuggestions);

export default router;
