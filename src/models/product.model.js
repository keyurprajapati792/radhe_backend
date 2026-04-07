import mongoose from "mongoose";

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  locationId: {
    type: Number,
    trim: true,
  },
});

const Product = mongoose.model("Product", productSchema);

export default Product;
