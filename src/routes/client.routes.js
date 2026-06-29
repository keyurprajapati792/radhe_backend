import express from "express";
import * as ClientController from "../controllers/client.controller.js";

const router = express.Router();

router.post("/", ClientController.createClient);

router.get("/", ClientController.getAllClients);

router.get("/:id", ClientController.getClientById);

router.put("/:id", ClientController.updateClient);

router.delete("/:id", ClientController.deleteClient);

export default router;
