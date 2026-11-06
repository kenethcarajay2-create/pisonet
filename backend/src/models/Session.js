import mongoose from 'mongoose';
const sessionSchema = new mongoose.Schema({ voucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'Voucher', required: true, unique: true }, computerId: { type: String, required: true }, startedAt: { type: Date, required: true }, expiresAt: { type: Date, required: true } }, { timestamps: true });
export default mongoose.model('Session', sessionSchema);
