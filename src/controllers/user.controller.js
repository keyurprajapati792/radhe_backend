import UserService from "../services/user.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createUser = async (req, res) =>
  Interceptor.responseHandler(() => UserService.createUser(req.body), res);

export const getAllUsers = async (req, res) =>
  Interceptor.responseHandler(() => UserService.getAllUsers(req.query), res);

export const getUserById = async (req, res) =>
  Interceptor.responseHandler(
    () => UserService.getUserById(req.params.id),
    res,
  );

export const updateUser = async (req, res) =>
  Interceptor.responseHandler(
    () => UserService.updateUser(req.params.id, req.body),
    res,
  );

export const deleteUser = async (req, res) =>
  Interceptor.responseHandler(() => UserService.deleteUser(req.params.id), res);
