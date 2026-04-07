import { User } from "../models/user.model.js";
import { generateToken } from "../utils/token.js";

class AuthService {
  async login(data) {
    const { email, password } = data;

    const user = await User.findOne({ email });
    if (!user) {
      return {
        success: false,
        statustype: "UNAUTHORIZED",
        message: "Invalid credentials",
      };
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return {
        success: false,
        statustype: "UNAUTHORIZED",
        message: "Invalid credentials",
      };
    }

    return {
      success: true,
      statustype: "OK",
      message: "Login successful",
      data: {
        user,
      },
    };
  }
}

export default new AuthService();
