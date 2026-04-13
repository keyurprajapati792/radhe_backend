import express from "express"
import { assignWorkers } from "../controllers/jobStep.controller.js";

const router = express.Router()

router.put("/:id/assign-workers", assignWorkers);


export default router