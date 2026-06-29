import SkillService from "../services/skill.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createSkill = async (req, res) => {
  return Interceptor.responseHandler(() => SkillService.create(req.body), res);
};

export const getAllSkills = async (req, res) => {
  return Interceptor.responseHandler(() => SkillService.getAll(req.query), res);
};

export const getSkillById = async (req, res) => {
  return Interceptor.responseHandler(
    () => SkillService.getById(req.params.id),
    res,
  );
};

export const updateSkill = async (req, res) => {
  return Interceptor.responseHandler(
    () => SkillService.update(req.params.id, req.body),
    res,
  );
};

export const updateSkillCost = async (req, res) => {
  return Interceptor.responseHandler(
    () => SkillService.updateCost(req.params.id, req.body.currentHourlyCost),
    res,
  );
};

export const deleteSkill = async (req, res) => {
  return Interceptor.responseHandler(
    () => SkillService.delete(req.params.id),
    res,
  );
};
