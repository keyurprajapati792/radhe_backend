import express from "express";

import ProductionSlotController from "../controllers/productionSlot.controller.js";

const router = express.Router();

router.post("/", ProductionSlotController.createSlots);

router.get("/:jobStepId", ProductionSlotController.getSlots);

router.patch("/:id/start", ProductionSlotController.startSlot);

router.patch("/:id/complete", ProductionSlotController.completeSlot);

export default router;
