const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'professor', 'admin'],
    required: true
  },
  courses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: {
    type: String,
    default: ''
  },
  xp: {
    type: Number,
    default: 0
  },
  level: {
    type: String,
    default: 'Bronze'
  },
  streak: {
    type: Number,
    default: 0
  },
  freezeTokens: {
    type: Number,
    default: 0
  },
  lastActiveDate: {
    type: Date
  },
  badges: [{
    name: String,
    icon: String,
    description: String,
    awardedAt: {
      type: Date,
      default: Date.now
    }
  }],
  activeTimes: [{
    hour: Number,
    count: {
      type: Number,
      default: 0
    }
  }]
}, {
  timestamps: true
});

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Method to verify passwords
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
