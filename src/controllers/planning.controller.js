
import PlanningService from "../services/planning.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const previewPlanning = async (req, res) => {
  return Interceptor.responseHandler(
    () => PlanningService.preview(req.body),
    res
  );
};