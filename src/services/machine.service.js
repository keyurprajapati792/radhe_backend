import Machine from "../models/machine.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import { calculateAvailableMinutes } from "../utils/utils.js";

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
      Machine.find(filter)
        .populate("requiredSkills", "name currentHourlyCost")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

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

  async getMachineUtilizationReport(query = {}) {
    const { locationId, startDate, endDate } = query;

    const machineFilter = {};

    if (locationId) {
      machineFilter.locationId = Number(locationId);
    }

    const machines = await Machine.find(machineFilter);

    const report = await Promise.all(
      machines.map(async (machine) => {
        const slots = await ProductionSlot.find({
          machineId: machine._id,
          startTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        });

        let runningMinutes = 0;
        let setupMinutes = 0;
        let overtimeMinutes = 0;

        slots.forEach((slot) => {
          const duration =
            (new Date(slot.endTime) - new Date(slot.startTime)) / 1000 / 60;

          runningMinutes += duration;
          setupMinutes += slot.setupMinutes || 0;
          overtimeMinutes += slot.overtimeMinutes || 0;
        });

        const totalAvailableMinutes = await calculateAvailableMinutes(
          startDate,
          endDate,
        );

        const runningHours = +(runningMinutes / 60).toFixed(2);

        const hours = Math.floor(runningMinutes / 60);
        const minutes = Math.round(runningMinutes % 60);

        const totalTime = `${hours}h ${minutes}m`;

        return {
          machineId: machine._id,
          machineName: machine.name,
          machineNumber: machine.machineNumber,
          totalTime: totalTime,
          setupHours: +(setupMinutes / 60).toFixed(2),
          overtimeHours: +(overtimeMinutes / 60).toFixed(2),
          jobsProcessed: new Set(slots.map((s) => String(s.jobId))).size,
        };
      }),
    );

    return {
      success: true,
      statustype: "OK",
      data: report,
    };
  }
}

export default new MachineService();
