const mongoose = require('mongoose');

const PlatformSettingsSchema = new mongoose.Schema({
  universityName: {
    type: String,
    default: "QuizAI University"
  },
  adminEmail: {
    type: String,
    default: "admin@quizai.edu"
  },
  questionsPerUpload: {
    type: Number,
    default: 5
  },
  questionTypes: {
    type: [String],
    default: ["mcq", "tf", "short"]
  },
  antiCheatSensitivity: {
    type: Number,
    default: 75
  },
  toggles: {
    liveBattles: {
      type: Boolean,
      default: true
    },
    antigravity: {
      type: Boolean,
      default: true
    },
    voiceQuiz: {
      type: Boolean,
      default: true
    },
    peerQuiz: {
      type: Boolean,
      default: true
    },
    biometricLogin: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PlatformSettings', PlatformSettingsSchema);
