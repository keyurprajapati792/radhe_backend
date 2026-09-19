import express from "express";
import { getResourceCalendar } from "../controllers/calendar.controller.js";

const router = express.Router();

router.get("/resources", getResourceCalendar);

export default router;
