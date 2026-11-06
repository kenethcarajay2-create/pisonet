import mongoose from 'mongoose';
const adminSchema = new mongoose.Schema({ email: { type: String, unique: true, required: true, lowercase: true }, passwordHash: { type: String, required: true } }, { timestamps: true });
export default mongoose.model('Admin', adminSchema);
