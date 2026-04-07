import Process from "../models/process.model.js";

class ProcessService {
  async createProcess(data) {
    const process = await Process.create(data);

    return {
      success: true,
      statustype: "CREATED",
      data: process,
    };
  }

  async getByProduct(productId) {
    const processes = await Process.find({ productId }).sort({ sequence: 1 });

    return {
      success: true,
      statustype: "OK",
      data: processes,
    };
  }
  async updateProcess(id, data) {
    const process = await Process.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!process) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Process not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Process updated successfully",
      data: process,
    };
  }
}

export default new ProcessService();
