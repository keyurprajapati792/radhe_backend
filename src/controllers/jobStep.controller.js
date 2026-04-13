
import jobStepService from "../services/jobStep.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const assignWorkers = async (req, res) => {
  const { id } = req.params;

  return Interceptor.responseHandler(
    () => jobStepService.assignWorkers(id, req.body),
    res
  );
};