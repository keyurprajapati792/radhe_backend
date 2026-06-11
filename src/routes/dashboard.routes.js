// routes/dashboard.routes.js

import express from "express";

import DashboardController from "../controllers/dashboard.controller.js";

const router = express.Router();

router.get("/stats", DashboardController.getDashboardStats);

export default router;
