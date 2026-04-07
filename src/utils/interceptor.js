export class Interceptor {
  static responseHandler = async (servicePromise, res) => {
    try {
      const { success, statustype, message, data, meta } =
        await servicePromise();
      if (success) {
        switch (statustype) {
          case "CREATED":
            return res
              .status(201)
              .json({ message: message, data: data || {}, meta: meta || {} });
          case "OK":
            return res
              .status(200)
              .json({ message: message, data: data || {}, meta: meta || {} });
          case "NO_CONTENT":
            return res.status(204).json({ message: message });
          default:
            return res.status(500).json({ message: "Internal Server Error" });
        }
      } else {
        switch (statustype) {
          case "BAD_REQUEST":
            return res.status(400).json({ message: message });
          case "FORBIDDEN":
            return res.status(403).json({ message: message });
          case "NOT_FOUND":
            return res.status(404).json({ message: message });
          case "CONFLICT":
            return res.status(409).json({ message: message });
          case "UNSUPPORTED_MEDIA_TYPE":
            return res.status(415).json({ message: message });
          case "UNAUTHORIZED":
            return res.status(401).json({ message: message });
          case "GONE":
            return res.status(410).json({ message: message });
          default:
            return res.status(500).json({ message: "Internal Server Error" });
        }
      }
    } catch (error) {
      console.error(`Error in Interceptor responseHandler: ${error}`);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  };
}
