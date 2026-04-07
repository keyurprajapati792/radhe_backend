import express from "express";
import {
  createMachine,
  getMachines,
  updateMachine,
} from "../controllers/machine.controller.js";

const router = express.Router();

router.post("/", createMachine);
router.get("/", getMachines);
router.put("/:id", updateMachine);

export default router;
