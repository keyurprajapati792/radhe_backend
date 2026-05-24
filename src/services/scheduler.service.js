import JobStep from "../models/jobStep.model.js";

import Process from "../models/process.model.js";

import Machine from "../models/machine.model.js";

import Worker from "../models/worker.model.js";

import ProductionSlot from "../models/productionSlot.model.js";

class SchedulerService {
  async getSuggestions(jobStepId) {
    const jobStep = await JobStep.findById(jobStepId);

    const process = await Process.findById(jobStep.processId);

    const previousStep = await JobStep.findOne({
      jobId: jobStep.jobId,
      sequence: jobStep.sequence - 1,
    });

    let previousStepEnd = new Date();

    if (previousStep) {
      const previousSlot = await ProductionSlot.findOne({
        jobStepId: previousStep._id,
      }).sort({ endTime: -1 });

      if (previousSlot) {
        previousStepEnd = previousSlot.endTime;
      }
    }

    const machines = await Machine.find({
      name: process.requiredMachineType,
      status: "available",
    });

    const machineIds = machines.map((m) => m._id);

    const skills = machines.flatMap((m) => m.requiredSkills);

    const workers = await Worker.find({
      skills: {
        $in: skills,
      },

      status: "available",
    });

    return {
      success: true,

      data: {
        process,
        previousStepEnd,
        machines,
        workers,
      },
    };
  }
}

export default new SchedulerService();
