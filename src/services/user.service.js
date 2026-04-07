import { User } from "../models/user.model.js";

class UserService {
  // CREATE
  async createUser(data) {
    const { firstname, middlename, lastname, email, phone, locationId, role } =
      data;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return {
        success: false,
        statustype: "CONFLICT",
        message: `${role} already exists`,
      };
    }

    let password = null;

    if (role !== "client") {
      password = `${firstname}@123$`;
    }

    const user = new User({
      firstname,
      middlename,
      lastname,
      email,
      password,
      phone,
      locationId,
      role,
    });

    await user.save();

    return {
      success: true,
      statustype: "CREATED",
      message: `${role} created successfully`,
      data: user,
    };
  }

  // GET ALL USERS
  async getAllUsers(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";
    const role = query.role || "";
    const locationId = query.locationId || "";

    const skip = (page - 1) * limit;

    const filter = { role, locationId };

    if (search) {
      filter.$or = [
        { firstname: { $regex: search, $options: "i" } },
        { lastname: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } },
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      User.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: users,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET SINGLE USER
  async getUserById(id) {
    const user = await User.findById(id);

    if (!user) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "User not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      data: user,
    };
  }

  // UPDATE USER
  async updateUser(id, data) {
    const user = await User.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "User not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "User updated successfully",
      data: user,
    };
  }

  // DELETE USER
  async deleteUser(id) {
    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "User not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "User deleted successfully",
    };
  }
}

export default new UserService();
