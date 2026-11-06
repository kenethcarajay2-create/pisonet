import { createHash, timingSafeEqual } from 'node:crypto';
export function requireDevice(req, res, next) {
  const expected = process.env.DEVICE_TOKEN;
  const provided = req.get('x-device-token');
  if (!expected || expected.length < 32 || !provided) return res.status(401).json({ error: 'Device not authorized' });
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  if (!timingSafeEqual(a, b)) return res.status(401).json({ error: 'Device not authorized' });
  next();
}
