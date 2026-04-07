import AuthService from "../services/auth.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const login = async (req, res) => {
  return Interceptor.responseHandler(() => AuthService.login(req.body), res);
};
