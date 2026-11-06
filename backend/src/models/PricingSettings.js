import mongoose from 'mongoose';
const presetSchema = new mongoose.Schema({ price: { type: Number, required: true, min: 0.01 }, minutes: { type: Number, required: true, min: 1, max: 1440 } }, { _id: false });
const schema = new mongoose.Schema({ key: { type: String, unique: true, default: 'default' }, minutesPerPeso: { type: Number, required: true, default: 6, min: 0.01 }, presets: { type: [presetSchema], default: () => [{price:5,minutes:30},{price:10,minutes:60},{price:15,minutes:90},{price:20,minutes:120},{price:25,minutes:180}] } }, { timestamps: true });
export default mongoose.model('PricingSettings', schema);
