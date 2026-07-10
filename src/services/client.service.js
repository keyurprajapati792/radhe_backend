import { Client } from "../models/client.model.js";

class ClientService {
  // CREATE
  async createClient(data) {
    const {
      customerCode,
      customerName,
      legalName,
      contactPerson,
      contactNumber,
      email,
      address,
      pincode,
      city,
      state,
      country,
      locationId,
    } = data;

    if (email) {
      const existing = await Client.findOne({ email });

      if (existing) {
        return {
          success: false,
          statustype: "CONFLICT",
          message: "Client already exists",
        };
      }
    }

    const client = await Client.create({
      customerCode,
      customerName,
      legalName,
      contactPerson,
      contactNumber,
      email,
      address,
      pincode,
      city,
      state,
      country,
      locationId,
    });

    return {
      success: true,
      statustype: "CREATED",
      message: "Client created successfully",
      data: client,
    };
  }

  // GET ALL
  async getAllClients(query = {}) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 10;
    const search = query.search || "";
    const locationId = query.locationId || "";

    const skip = (page - 1) * limit;

    const filter = {};

    if (locationId) {
      filter.locationId = locationId;
    }

    if (search) {
      filter.$or = [
        {
          customerCode: {
            $regex: search,
            $options: "i",
          },
        },
        {
          customerName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          legalName: {
            $regex: search,
            $options: "i",
          },
        },
        {
          contactPerson: {
            $regex: search,
            $options: "i",
          },
        },
        {
          contactNumber: {
            $regex: search,
            $options: "i",
          },
        },
        {
          email: {
            $regex: search,
            $options: "i",
          },
        },
      ];
    }

    const [clients, total] = await Promise.all([
      Client.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Client.countDocuments(filter),
    ]);

    return {
      success: true,
      statustype: "OK",
      data: clients,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET BY ID
  async getClientById(id) {
    const client = await Client.findById(id);

    if (!client) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Client not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      data: client,
    };
  }

  // UPDATE
  async updateClient(id, data) {
    if (data.email) {
      const existing = await Client.findOne({
        email: data.email,
        _id: { $ne: id },
      });

      if (existing) {
        return {
          success: false,
          statustype: "CONFLICT",
          message: "Email already exists",
        };
      }
    }

    const client = await Client.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    });

    if (!client) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Client not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Client updated successfully",
      data: client,
    };
  }

  // DELETE
  async deleteClient(id) {
    const client = await Client.findByIdAndDelete(id);

    if (!client) {
      return {
        success: false,
        statustype: "NOT_FOUND",
        message: "Client not found",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Client deleted successfully",
    };
  }
}

export default new ClientService();
