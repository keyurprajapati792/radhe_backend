// services/workConfig.service.js

import WorkConfig from "../models/workConfig.model.js";

class WorkConfigService {
  async createOrUpdate(data) {
    const { locationId, workingHours, breaks, overtime } = data;

    if (!locationId || !workingHours) {
      return {
        success: false,
        statustype: "BAD_REQUEST",
        message: "Missing required fields",
      };
    }

    const config = await WorkConfig.findOneAndUpdate(
      { locationId },
      {
        workingHours,
        breaks,
        overtime,
      },
      { new: true, upsert: true }
    );

    return {
      success: true,
      statustype: "OK",
      message: "Work config saved successfully",
      data: config,
    };
  }

  async getByLocation(locationId) {
    const config = await WorkConfig.findOne({ locationId });

    if (!config) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Work config not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Work config fetched",
      data: config,
    };
  }
}

export default new WorkConfigService();