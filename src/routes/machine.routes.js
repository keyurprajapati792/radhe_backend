import express from "express";
import {
  createMachine,
  getMachines,
  getMachineUtilizationReport,
  updateMachine,
} from "../controllers/machine.controller.js";

const router = express.Router();

router.post("/", createMachine);
router.get("/", getMachines);
router.put("/:id", updateMachine);
router.get("/report/utilization", getMachineUtilizationReport);

export default router;
