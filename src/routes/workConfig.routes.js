import express from "express"
import { getWorkConfig, saveWorkConfig } from "../controllers/workConfig.controller.js";
const router = express.Router()


router.post("/", saveWorkConfig);
router.get("/:locationId", getWorkConfig);

export default router

