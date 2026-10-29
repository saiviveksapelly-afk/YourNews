import { Schema, model } from 'mongoose';

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    profileImageUrl: String,
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      required: true,
    },
    isDemo: {
      type: Boolean,
      default: false,
      select: false,
    },
  },
  { timestamps: true },
);

const User = model('User', userSchema);

export default User;
