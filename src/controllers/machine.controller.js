import MachineService from "../services/machine.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createMachine = async (req, res) => {
  return Interceptor.responseHandler(
    () => MachineService.createMachine(req.body),
    res,
  );
};

export const getMachines = async (req, res) => {
  return Interceptor.responseHandler(
    () => MachineService.getMachines(req.query),
    res,
  );
};

export const updateMachine = async (req, res) => {
  return Interceptor.responseHandler(
    () => MachineService.updateMachine(req.params.id, req.body),
    res,
  );
};
