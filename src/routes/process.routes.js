import express from "express";
import {
  createProcess,
  getProcessesByProduct,
  updateProcess,
} from "../controllers/process.controller.js";

const router = express.Router();

router.post("/", createProcess);
router.get("/:productId", getProcessesByProduct);
router.put("/:id", updateProcess);

export default router;
