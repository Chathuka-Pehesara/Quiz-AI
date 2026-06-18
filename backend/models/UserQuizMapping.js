const mongoose = require('mongoose');

const UserQuizMappingSchema = new mongoose.Schema({
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
  shuffledTopics: [String],
  shuffledQuestions: [{
    questionId: String,
    shuffledOptions: [String]
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('UserQuizMapping', UserQuizMappingSchema);
