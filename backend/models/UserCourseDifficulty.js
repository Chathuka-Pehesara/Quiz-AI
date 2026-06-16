const mongoose = require('mongoose');

const UserCourseDifficultySchema = new mongoose.Schema({
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
  topicDifficulties: [{
    topic: { 
      type: String, 
      required: true,
      trim: true
    },
    difficulty: { 
      type: Number, 
      required: true, 
      default: 3, 
      min: 1, 
      max: 5 
    },
    attempts: { 
      type: Number, 
      default: 0 
    },
    correctAttempts: { 
      type: Number, 
      default: 0 
    }
  }]
}, {
  timestamps: true
});

// Compound index to ensure uniqueness per student and course
UserCourseDifficultySchema.index({ student: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('UserCourseDifficulty', UserCourseDifficultySchema);
