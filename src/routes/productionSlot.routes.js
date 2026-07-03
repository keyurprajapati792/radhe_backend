import express from "express";

import ProductionSlotController from "../controllers/productionSlot.controller.js";

const router = express.Router();

router.post("/", ProductionSlotController.createSlots);
router.get("/:jobStepId", ProductionSlotController.getSlots);
router.get(
  "/:slotId/replacement-workers",
  ProductionSlotController.getReplacementWorkers,
);
router.get(
  "/:slotId/replacement-machines",
  ProductionSlotController.getReplacementMachines,
);
router.patch("/:id/start", ProductionSlotController.startSlot);
router.patch("/:id/complete", ProductionSlotController.completeSlot);
router.put("/update", ProductionSlotController.updateSlots);

export default router;
