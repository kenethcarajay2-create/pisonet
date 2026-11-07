
import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    computerId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true
    },
    tokenHash: {
      type: String,
      unique: true,
      sparse: true,
      select: false
    },
    lastSeenAt: Date,
    adminMode: {
      type: String,
      enum: ['open', 'timed', null],
      default: null
    },
    adminStartedAt: Date,
    adminExpiresAt: Date
  },
  { timestamps: true }
);

export default mongoose.model('Computer', schema);
