const mongoose = require('mongoose');

const CheatFlagSchema = new mongoose.Schema({
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
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: true
  },
  flagReason: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['unreviewed', 'reviewed', 'escalated'],
    default: 'unreviewed'
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CheatFlag', CheatFlagSchema);
