import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  computerId: { type: String, required: true, unique: true },
  lastSeenAt: Date,
  adminMode: { type: String, enum: ['open', 'timed', null], default: null },
  adminStartedAt: Date,
  adminExpiresAt: Date
}, { timestamps: true });
export default mongoose.model('Computer', schema);
