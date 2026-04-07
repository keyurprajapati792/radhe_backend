import ProductService from "../services/product.service.js";
import { Interceptor } from "../utils/interceptor.js";

export const createProduct = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProductService.createProduct(req.body),
    res,
  );
};

export const getProducts = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProductService.getProducts(req.query),
    res,
  );
};

export const getProductById = async (req, res) => {
  return Interceptor.responseHandler(
    () => ProductService.getProductById(req.params.id),
    res,
  );
};
