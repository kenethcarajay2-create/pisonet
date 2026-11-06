import mongoose from 'mongoose';
const voucherSchema = new mongoose.Schema({ codeHash: { type: String, unique: true, required: true }, durationMinutes: { type: Number, required: true, min: 1, max: 1440 }, price: { type: Number, required: true, min: 0 }, status: { type: String, enum: ['unused', 'redeemed'], default: 'unused' }, redeemedAt: Date, computerId: String }, { timestamps: true });
export default mongoose.model('Voucher', voucherSchema);
