import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";

import authRoutes from "./routes/authRoutes.js";
import voucherRoutes from "./routes/voucherRoutes.js";
import pricingRoutes from "./routes/pricingRoutes.js";
import deviceRoutes from "./routes/deviceRoutes.js";
import computerRoutes from "./routes/computerRoutes.js";

const app = express();

app.disable("x-powered-by");
app.use(helmet());

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim());

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed"));
    },
  }),
);

app.use(express.json({ limit: "20kb" }));

// API routes
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api/vouchers", voucherRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/device", deviceRoutes);
app.use("/api/computers", computerRoutes);

// Serve the React admin dashboard in production
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));

  const frontendPath = path.resolve(__dirname, "../../admin-web/dist");

  app.use(express.static(frontendPath));

  // React Router fallback, excluding API requests
  app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
  });
}

// Unknown API endpoints
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Error handler
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
