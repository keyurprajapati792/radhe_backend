import Machine from "../models/machine.model.js";

class MachineService {
  async createMachine(data) {
    const machine = await Machine.create(data);

    return {
      success: true,
      statustype: "CREATED",
      data: machine,
    };
  }

  async getMachines(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";
    const locationId = query.locationId;
    const status = query.status;

    const skip = (page - 1) * limit;

    const filter = {};

    if (locationId) {
      filter.locationId = Number(locationId);
    }

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { machineNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
      ];
    }

    const [machines, total] = await Promise.all([
      Machine.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Machine.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: machines,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateMachine(id, data) {
    const machine = await Machine.findByIdAndUpdate(id, data, { new: true });

    return {
      success: true,
      statustype: "OK",
      data: machine,
    };
  }
}

export default new MachineService();
