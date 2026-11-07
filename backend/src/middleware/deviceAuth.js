import { createHash, timingSafeEqual } from "node:crypto";
import Computer from "../models/Computer.js";

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

export async function requireDevice(req, res, next) {
  try {
    const provided = req.get("x-device-token");

    if (
      typeof provided !== "string" ||
      provided.length < 32 ||
      provided.length > 512
    ) {
      return res.status(401).json({
        error: "Device not authorized",
      });
    }

    const providedHash = hashToken(provided);

    // Check individually registered computers.
    const computer = await Computer.findOne({
      tokenHash: providedHash,
    }).select("+tokenHash");

    if (computer) {
      req.computerId = computer.computerId;
      return next();
    }

    // Preserve existing PC-01 configuration.
    const legacyToken = process.env.DEVICE_TOKEN;

    if (typeof legacyToken === "string" && legacyToken.length >= 32) {
      const providedBuffer = Buffer.from(providedHash, "hex");
      const legacyBuffer = Buffer.from(hashToken(legacyToken), "hex");

      if (timingSafeEqual(providedBuffer, legacyBuffer)) {
        req.computerId = "PC-01";
        return next();
      }
    }

    return res.status(401).json({
      error: "Device not authorized",
    });
  } catch (error) {
    next(error);
  }
}
