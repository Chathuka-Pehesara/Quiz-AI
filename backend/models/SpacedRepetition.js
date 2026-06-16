const mongoose = require('mongoose');

const SpacedRepetitionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  easeFactor: {
    type: Number,
    required: true,
    default: 2.5 // Default initial SM-2 ease factor
  },
  interval: {
    type: Number, // Interval in days
    required: true,
    default: 0
  },
  repetitionCount: {
    type: Number,
    required: true,
    default: 0
  },
  nextReviewDate: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true
});

// Ensure a student has only one spaced repetition scheduler record per course topic
SpacedRepetitionSchema.index({ student: 1, course: 1, topic: 1 }, { unique: true });

module.exports = mongoose.model('SpacedRepetition', SpacedRepetitionSchema);
