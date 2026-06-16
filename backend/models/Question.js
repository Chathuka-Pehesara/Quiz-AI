const mongoose = require('mongoose');

const QuestionSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['mcq', 'short', 'tf'],
    required: true
  },
  options: [{
    type: String
  }],
  correctAnswer: {
    type: String,
    required: true,
    trim: true
  },
  difficulty: {
    type: mongoose.Schema.Types.Mixed,
    default: 3
  },
  explanation: {
    type: String,
    trim: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  }
});

module.exports = {
  model: mongoose.model('Question', QuestionSchema),
  schema: QuestionSchema
};
