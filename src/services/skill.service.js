import Skill from "../models/skill.model.js";

class SkillService {
  async create(data) {
    const { name, currentHourlyCost } = data;

    if (!name || currentHourlyCost == null) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "Missing required fields",
      };
    }

    const existingSkill = await Skill.findOne({
      name: name.toUpperCase(),
    });

    if (existingSkill) {
      return {
        success: false,
        statustype: "CONFLICT",
        message: "Skill already exists",
      };
    }

    const skill = await Skill.create({
      name: name.toUpperCase(),
      currentHourlyCost,

      costHistory: [
        {
          hourlyCost: currentHourlyCost,
          effectiveFrom: new Date(),
        },
      ],
    });

    return {
      success: true,
      statustype: "CREATED",
      message: "Skill created successfully",
      data: skill,
    };
  }

  async getAll() {
    const skills = await Skill.find({
      isActive: true,
    }).sort({ name: 1 });

    return {
      success: true,
      statustype: "OK",
      message: "Skills fetched successfully",
      data: skills,
    };
  }

  async getById(skillId) {
    const skill = await Skill.findById(skillId);

    if (!skill) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Skill not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Skill fetched successfully",
      data: skill,
    };
  }

  async update(skillId, data) {
    const skill = await Skill.findById(skillId);

    if (!skill) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Skill not found",
      };
    }

    if (data.name) {
      skill.name = data.name.toUpperCase();
    }

    await skill.save();

    return {
      success: true,
      statustype: "OK",
      message: "Skill updated successfully",
      data: skill,
    };
  }

  async updateCost(skillId, currentHourlyCost) {
    const skill = await Skill.findById(skillId);

    if (!skill) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Skill not found",
      };
    }

    const lastHistory = skill.costHistory.at(-1);

    if (lastHistory && !lastHistory.effectiveTo) {
      lastHistory.effectiveTo = new Date();
    }

    skill.currentHourlyCost = currentHourlyCost;

    skill.costHistory.push({
      hourlyCost: currentHourlyCost,
      effectiveFrom: new Date(),
      effectiveTo: null,
    });

    await skill.save();

    return {
      success: true,
      statustype: "OK",
      message: "Skill cost updated successfully",
      data: skill,
    };
  }

  async delete(skillId) {
    const skill = await Skill.findById(skillId);

    if (!skill) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Skill not found",
      };
    }

    skill.isActive = false;

    await skill.save();

    return {
      success: true,
      statustype: "OK",
      message: "Skill deleted successfully",
    };
  }
}

export default new SkillService();
