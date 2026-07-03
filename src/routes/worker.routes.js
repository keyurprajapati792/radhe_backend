import express from "express";
import {
  createWorker,
  deleteWorker,
  getWorkerById,
  getWorkers,
  getWorkerUtilizationReport,
  updateWorker,
  updateWorkerStatus,
} from "../controllers/worker.controller.js";

const router = express.Router();

router.post("/", createWorker);
router.get("/", getWorkers);
router.get("/:id", getWorkerById);
router.put("/:id", updateWorker);
router.patch("/:id/status", updateWorkerStatus);
router.delete("/:id", deleteWorker);
router.get("/report/utilization", getWorkerUtilizationReport);

export default router;
