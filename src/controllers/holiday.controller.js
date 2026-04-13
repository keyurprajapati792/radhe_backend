// controllers/holiday.controller.js

import HolidayService from "../services/holiday.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createHoliday = async (req, res) => {
  return Interceptor.responseHandler(
    () => HolidayService.create(req.body),
    res
  );
};

export const getHolidays = async (req, res) => {
  return Interceptor.responseHandler(
    () => HolidayService.getAll(req.query),
    res
  );
};

export const deleteHoliday = async (req, res) => {
  const { id } = req.params;

  return Interceptor.responseHandler(
    () => HolidayService.remove(id),
    res
  );
};