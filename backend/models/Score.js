const mongoose = require('mongoose');

const ScoreSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: true
  },
  score: {
    type: Number,
    required: true
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  answers: [{
    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Question'
    },
    topic: {
      type: String,
      required: true
    },
    difficulty: {
      type: mongoose.Schema.Types.Mixed
    },
    answerGiven: {
      type: String
    },
    isCorrect: {
      type: Boolean,
      required: true
    }
  }],
  completedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Score', ScoreSchema);
