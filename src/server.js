import dns from "dns";

dns.setServers(["1.1.1.1", "1.0.0.1"]);

import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { connectDB } from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import locationRoutes from "./routes/location.routes.js";
import workerRoutes from "./routes/worker.routes.js";
import machineRoutes from "./routes/machine.routes.js";
import processRoutes from "./routes/process.routes.js";
import productRoutes from "./routes/product.routes.js";
import planningRoutes from "./routes/planning.routes.js";
import jobRoutes from "./routes/job.routes.js";
import jobStepRoutes from "./routes/jobStep.routes.js";
import workConfigRoutes from "./routes/workConfig.routes.js";
import holidayRoutes from "./routes/holday.routes.js";

dotenv.config();
connectDB();

const app = express();

const clientUrls = [
  "http://localhost:5173",
  "https://radhe-frontend.onrender.com",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || clientUrls.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json());

app.use("/v1/auth", authRoutes);
app.use("/v1/user", userRoutes);
app.use("/v1/location", locationRoutes);
app.use("/v1/worker", workerRoutes);
app.use("/v1/machine", machineRoutes);
app.use("/v1/product", productRoutes);
app.use("/v1/process", processRoutes);
app.use("/v1/planning", planningRoutes);
app.use("/v1/job", jobRoutes);
app.use("/v1/jobStep", jobStepRoutes);
app.use("/v1/work-config", workConfigRoutes);
app.use("/v1/holiday", holidayRoutes);

app.get("/", (req, res) => {
  res.send("API Running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
