import Machine from "../models/machine.model.js";
import ProductionSlot from "../models/productionSlot.model.js";
import { calculateAvailableMinutes, getAffectedJobs } from "../utils/utils.js";

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

    // Only filter stored statuses
    if (status && status !== "running") {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { machineNumber: { $regex: search, $options: "i" } },
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

    const machineIds = machines.map((m) => m._id);

    const runningSlots = await ProductionSlot.find({
      machineId: { $in: machineIds },
      status: "running",
    })
      .select("machineId jobId jobStepId")
      .lean();

    const runningMachineIds = new Set(
      runningSlots.map((slot) => slot.machineId.toString()),
    );

    let formattedMachines = machines.map((machine) => {
      const data = machine.toObject();

      // Only override if machine is operationally available
      if (
        data.status === "available" &&
        runningMachineIds.has(machine._id.toString())
      ) {
        data.status = "running";
      }

      return data;
    });

    // Handle derived status filtering
    if (status === "running") {
      formattedMachines = formattedMachines.filter(
        (m) => m.status === "running",
      );
    }

    return {
      success: true,
      statustype: "OK",
      data: formattedMachines,
      meta: {
        total: status === "running" ? formattedMachines.length : total,
        page,
        limit,
        totalPages: Math.ceil(
          (status === "running" ? formattedMachines.length : total) / limit,
        ),
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

  async updateMachineStatus(id, status) {
    const machine = await Machine.findById(id);

    if (!machine) {
      throw new Error("Machine not found");
    }

    machine.status = status;
    await machine.save();

    let affectedData;

    if (status === "maintenance") {
      affectedData = await getAffectedJobs({
        machineId: machine._id,
      });
    }

    return {
      success: true,
      statustype: "OK",
      message: "Machine status updated successfully.",
      data: {
        machine,
        affectedJobs: affectedData?.affectedJobs || [],
        summary: affectedData?.summary || null,
      },
    };
  }

  async getMachineUtilizationReport(query = {}) {
    const { locationId, machineId, startDate, endDate } = query;

    const machineFilter = {};

    if (locationId) {
      machineFilter.locationId = Number(locationId);
    }

    if (machineId) {
      machineFilter._id = machineId;
    }

    const machines = await Machine.find(machineFilter).sort({
      machineNumber: 1,
    });

    const report = await Promise.all(
      machines.map(async (machine) => {
        const slots = await ProductionSlot.find({
          machineId: machine._id,
          status: "completed",
          plannedStartTime: {
            $gte: new Date(startDate),
            $lte: new Date(endDate),
          },
        })
          .populate({
            path: "jobId",
            select: "name ref_code",
          })
          .populate({
            path: "jobStepId",
            populate: {
              path: "processId",
              select: "name",
            },
          })
          .sort({
            plannedStartTime: 1,
          });

        let runningMinutes = 0;
        let setupMinutes = 0;
        let overtimeMinutes = 0;

        let producedQty = 0;
        let approvedQty = 0;
        let rejectQty = 0;
        let reworkQty = 0;

        const jobs = new Set();
        const processes = new Set();

        const jobMap = new Map();

        slots.forEach((slot) => {
          const start = slot.actualStartTime || slot.plannedStartTime;
          const end = slot.actualEndTime || slot.plannedEndTime;

          const duration = Math.max(
            (new Date(end) - new Date(start)) / 1000 / 60,
            0,
          );

          runningMinutes += duration;
          setupMinutes += slot.setupMinutes || 0;
          overtimeMinutes += slot.overtimeMinutes || 0;

          producedQty += slot.producedQty || 0;
          approvedQty += slot.approvedQty || 0;
          rejectQty += slot.rejectQty || 0;
          reworkQty += slot.reworkQty || 0;

          if (slot.jobId) {
            jobs.add(slot.jobId._id.toString());
          }

          if (slot.jobStepId?.processId) {
            processes.add(slot.jobStepId.processId._id.toString());
          }

          // Group by Job + Process
          const key = `${slot.jobId?._id}_${slot.jobStepId?.processId?._id}`;

          if (!jobMap.has(key)) {
            jobMap.set(key, {
              jobId: slot.jobId?._id,
              jobName: slot.jobId?.name,
              refCode: slot.jobId?.ref_code,

              processId: slot.jobStepId?.processId?._id,
              process: slot.jobStepId?.processId?.name,

              runningMinutes: 0,

              producedQty: 0,
              approvedQty: 0,
              rejectQty: 0,
              reworkQty: 0,

              slots: [],
            });
          }

          const job = jobMap.get(key);

          job.runningMinutes += duration;

          job.producedQty += slot.producedQty || 0;
          job.approvedQty += slot.approvedQty || 0;
          job.rejectQty += slot.rejectQty || 0;
          job.reworkQty += slot.reworkQty || 0;

          job.slots.push({
            slotId: slot._id,

            status: slot.status,

            plannedStartTime: slot.plannedStartTime,
            plannedEndTime: slot.plannedEndTime,

            actualStartTime: slot.actualStartTime,
            actualEndTime: slot.actualEndTime,

            runningHours: +(duration / 60).toFixed(2),

            setupMinutes: slot.setupMinutes,
            overtimeMinutes: slot.overtimeMinutes,

            producedQty: slot.producedQty,
            approvedQty: slot.approvedQty,
            rejectQty: slot.rejectQty,
            reworkQty: slot.reworkQty,
          });
        });

        const jobsData = Array.from(jobMap.values()).map((job) => ({
          ...job,
          runningHours: +(job.runningMinutes / 60).toFixed(2),
        }));

        const hours = Math.floor(runningMinutes / 60);
        const minutes = Math.round(runningMinutes % 60);

        return {
          machineId: machine._id,
          machineName: machine.name,
          machineNumber: machine.machineNumber,

          totalTime: `${hours}h ${minutes}m`,
          runningHours: +(runningMinutes / 60).toFixed(2),
          setupHours: +(setupMinutes / 60).toFixed(2),
          overtimeHours: +(overtimeMinutes / 60).toFixed(2),

          jobsProcessed: jobs.size,
          processesPerformed: processes.size,

          producedQty,
          approvedQty,
          rejectQty,
          reworkQty,

          jobs: jobsData,
        };
      }),
    );

    const filteredReport = report.filter((machine) => machine.jobs.length > 0);

    return {
      success: true,
      statustype: "OK",
      data: filteredReport,
    };
  }
}

export default new MachineService();
