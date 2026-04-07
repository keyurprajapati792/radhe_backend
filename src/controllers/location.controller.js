import LocationService from "../services/location.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createLocation = async (req, res) => {
  return Interceptor.responseHandler(
    () => LocationService.createLocation(req.body),
    res,
  );
};

export const getLocations = async (req, res) => {
  return Interceptor.responseHandler(
    () => LocationService.getLocations(req.query),
    res,
  );
};

export const updateLocation = async (req, res) => {
  return Interceptor.responseHandler(
    () => LocationService.updateLocation(req.params.id, req.body),
    res,
  );
};

export const deleteLocation = async (req, res) => {
  return Interceptor.responseHandler(
    () => LocationService.deleteLocation(req.params.id),
    res,
  );
};
