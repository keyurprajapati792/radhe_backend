import express from "express"
import { createHoliday, deleteHoliday, getHolidays } from "../controllers/holiday.controller.js";

const router = express.Router()

router.post("/", createHoliday);
router.get("/", getHolidays);
router.delete("/:id", deleteHoliday);

export default router