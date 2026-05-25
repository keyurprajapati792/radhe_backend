import JobStep from "../models/jobStep.model.js";
import Machine from "../models/machine.model.js";
import Worker from "../models/worker.model.js";
import ProductionSlot from "../models/productionSlot.model.js";

class SchedulerService {
  async getSuggestions(jobStepId, locationId) {
    const jobStep = await JobStep.findById(jobStepId).populate("processId");

    if (!jobStep) {
      throw new Error("Job step not found");
    }

    // ---------------- PREVIOUS STEP ----------------

    const previousStep = await JobStep.findOne({
      jobId: jobStep.jobId,
      sequence: jobStep.sequence - 1,
    });

    let previousStepEnd = new Date();

    if (previousStep) {
      const previousSlot = await ProductionSlot.findOne({
        jobStepId: previousStep._id,
      }).sort({ endTime: -1 });

      if (previousSlot?.endTime) {
        previousStepEnd = new Date(previousSlot.endTime);
      }
    }

    // ---------------- FIND MACHINES ----------------

    const machines = await Machine.find({
      type: jobStep.processId.machineType,
      status: "available",
      locationId,
    }).sort({
      availableFrom: 1,
    });

    // ---------------- PICK BEST MACHINE ----------------

    let selectedMachine = null;

    let processStartTime = previousStepEnd;

    for (const machine of machines) {
      const machineAvailableFrom = machine.availableFrom
        ? new Date(machine.availableFrom)
        : new Date();

      const machineStartTime =
        machineAvailableFrom > previousStepEnd
          ? machineAvailableFrom
          : previousStepEnd;

      if (!selectedMachine) {
        selectedMachine = machine;

        processStartTime = machineStartTime;

        continue;
      }

      // choose earliest possible start
      if (machineStartTime < processStartTime) {
        selectedMachine = machine;

        processStartTime = machineStartTime;
      }
    }

    // ---------------- PROCESS END TIME ----------------

    const overtimeMinutes = jobStep.overtimeMinutes || 0;

    const totalMinutes = jobStep.totalEstimatedTime + overtimeMinutes;

    const processEndTime = new Date(
      processStartTime.getTime() + totalMinutes * 60 * 1000,
    );

    // ---------------- WORKERS ----------------

    let workers = [];

    if (selectedMachine?.requiredSkills?.length) {
      workers = await Worker.find({
        skills: {
          $in: selectedMachine.requiredSkills,
        },

        status: "available",

        locationId,
      }).limit(jobStep.requiredManpower);
    }

    return {
      process: jobStep.processId,
      processStartTime,
      processEndTime,
      machine: selectedMachine,
      workers,
      requiredManpower: jobStep.requiredManpower,
    };
  }
}

export default new SchedulerService();
