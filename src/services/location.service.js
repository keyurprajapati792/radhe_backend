import { Location } from "../models/location.model.js";

class LocationService {
  // CREATE
  async createLocation(data) {
    const { name } = data;

    const existing = await Location.findOne({ name });
    if (existing) {
      return {
        success: false,
        statustype: "CONFLICT",
        message: "Location already exists",
      };
    }

    const location = await Location.create({ name });

    return {
      success: true,
      statustype: "CREATED",
      message: "Location created successfully",
      data: location,
    };
  }

  // GET ALL
  async getLocations(query) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";

    const skip = (page - 1) * limit;

    const filter = {
      name: { $regex: search, $options: "i" },
    };

    const [locations, total] = await Promise.all([
      Location.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Location.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: locations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  // UPDATE
  async updateLocation(id, data) {
    const updated = await Location.findByIdAndUpdate(
      id,
      { name: data.name },
      { new: true },
    );

    if (!updated) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Location not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Location updated successfully",
      data: updated,
    };
  }

  // DELETE
  async deleteLocation(id) {
    const deleted = await Location.findByIdAndDelete(id);

    if (!deleted) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Location not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Location deleted successfully",
    };
  }
}

export default new LocationService();
