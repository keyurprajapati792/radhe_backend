import CalendarService from "../services/calendar.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const getResourceCalendar = async (req, res) => {
  return Interceptor.responseHandler(
    () => CalendarService.getResourceCalendar(req.query),
    res,
  );
};
