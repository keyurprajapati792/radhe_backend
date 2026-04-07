import WorkerService from "../services/worker.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createWorker = async (req, res) => {
  return Interceptor.responseHandler(
    () => WorkerService.createWorker(req.body),
    res,
  );
};

export const getWorkers = async (req, res) => {
  return Interceptor.responseHandler(
    () => WorkerService.getWorkers(req.query),
    res,
  );
};
export const getWorkerById = async (req, res) =>
  Interceptor.responseHandler(
    () => WorkerService.getWorkerById(req.params.id),
    res,
  );

export const updateWorker = async (req, res) => {
  return Interceptor.responseHandler(
    () => WorkerService.updateWorker(req.params.id, req.body),
    res,
  );
};

export const deleteWorker = async (req, res) => {
  return Interceptor.responseHandler(
    () => WorkerService.deleteWorker(req.params.id),
    res,
  );
};
