import Process from "../models/process.model.js";
import Product from "../models/product.model.js";

class ProductService {
  async createProduct(data) {
    const product = await Product.create(data);

    return {
      success: true,
      statustype: "CREATED",
      data: product,
    };
  }

  async getProducts(query = {}) {
    const locationId = query.locationId || "";

    const products = await Product.find({ locationId }).sort({ createdAt: -1 });

    return {
      success: true,
      statustype: "OK",
      data: products,
    };
  }

  async getProductById(id) {
    const product = await Product.findById(id);

    if (!product) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Product not found",
      };
    }

    const processes = await Process.find({ productId: id }).sort({
      sequence: 1,
    });

    return {
      success: true,
      statustype: "OK",
      data: {
        ...product.toObject(),
        processes,
      },
    };
  }
}

export default new ProductService();
