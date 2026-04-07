import express from "express";
import {
  createLocation,
  getLocations,
  updateLocation,
  deleteLocation,
} from "../controllers/location.controller.js";

const router = express.Router();

router.post("/", createLocation);
router.get("/", getLocations);
router.put("/:id", updateLocation);
router.delete("/:id", deleteLocation);

export default router;
