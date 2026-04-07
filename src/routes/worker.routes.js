import express from "express";
import {
  createWorker,
  deleteWorker,
  getWorkerById,
  getWorkers,
  updateWorker,
} from "../controllers/worker.controller.js";

const router = express.Router();

router.post("/", createWorker);
router.get("/", getWorkers);
router.get("/:id", getWorkerById);
router.put("/:id", updateWorker);
router.delete("/:id", deleteWorker);

export default router;
