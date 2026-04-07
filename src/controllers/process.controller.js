import ProcessService from "../services/process.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createProcess = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProcessService.createProcess(req.body),
    res,
  );
};

export const getProcessesByProduct = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProcessService.getByProduct(req.params.productId),
    res,
  );
};

export const updateProcess = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProcessService.updateProcess(req.params.id, req.body),
    res,
  );
};
