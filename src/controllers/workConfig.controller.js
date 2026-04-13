
import WorkConfigService from "../services/workConfig.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const saveWorkConfig = async (req, res) => {
  return Interceptor.responseHandler(
    () => WorkConfigService.createOrUpdate(req.body),
    res
  );
};

export const getWorkConfig = async (req, res) => {
  const { locationId } = req.params;

  return Interceptor.responseHandler(
    () => WorkConfigService.getByLocation(locationId),
    res
  );
};