import ClientService from "../services/client.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createClient = async (req, res) =>
  Interceptor.responseHandler(() => ClientService.createClient(req.body), res);

export const getAllClients = async (req, res) =>
  Interceptor.responseHandler(
    () => ClientService.getAllClients(req.query),
    res,
  );

export const getClientById = async (req, res) =>
  Interceptor.responseHandler(
    () => ClientService.getClientById(req.params.id),
    res,
  );

export const updateClient = async (req, res) =>
  Interceptor.responseHandler(
    () => ClientService.updateClient(req.params.id, req.body),
    res,
  );

export const deleteClient = async (req, res) =>
  Interceptor.responseHandler(
    () => ClientService.deleteClient(req.params.id),
    res,
  );
