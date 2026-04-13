
import express from "express";
import { previewPlanning } from "../controllers/planning.controller.js";


const router = express.Router()

router.post("/preview", previewPlanning);

export default  router