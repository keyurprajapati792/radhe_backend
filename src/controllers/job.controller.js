// controllers/job.controller.js

import JobService from "../services/job.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createJob = async (req, res) => {
  return Interceptor.responseHandler(
    () => JobService.create(req.body),
    res
  );
};