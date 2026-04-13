// services/holiday.service.js

import Holiday from "../models/holiday.model.js";

class HolidayService {
async create(data) {
  const { locationId, holidays } = data;

  if (!locationId || !holidays?.length) {
    return {
      success: false,
      statustype: "BAD_REQUEST",
      message: "Missing required fields",
    };
  }

  const payload = holidays.map((h) => ({
    locationId,
    name: h.name,
    date: h.date,
  }));

  const created = await Holiday.insertMany(payload);

  return {
    success: true,
    statustype: "OK",
    message: "Holidays saved",
    data: created,
  };
}

  async getAll() {

    const holidays = await Holiday.find({ }).sort({ date: 1 });

    return {
      success: true,
      statustype: "OK",
      message: "Holidays fetched",
      data: holidays,
    };
  }

  async remove(id) {
    const holiday = await Holiday.findByIdAndDelete(id);

    if (!holiday) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Holiday not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Holiday deleted",
    };
  }
}

export default new HolidayService();