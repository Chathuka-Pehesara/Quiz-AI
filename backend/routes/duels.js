const express = require('express');
const Duel = require('../models/Duel');
const User = require('../models/User');
const Quiz = require('../models/Quiz');
const auth = require('../middleware/auth');
const router = express.Router();

// Challenge a peer by username
router.post('/challenge', auth('student'), async (req, res) => {
  const { challengedUsername, quizId, challengerScore } = req.body;
  try {
    const challengedUser = await User.findOne({ name: new RegExp(`^${challengedUsername.trim()}$`, 'i'), role: 'student' });
    if (!challengedUser) {
      return res.status(404).json({ message: 'Classmate username not found' });
    }

    if (challengedUser._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot challenge yourself' });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const duel = new Duel({
      challenger: req.user.id,
      challenged: challengedUser._id,
      quiz: quizId,
      challengerScore,
      challengerCompleted: true,
      status: 'pending'
    });

    await duel.save();
    res.status(201).json(duel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's active duels
router.get('/active', auth('student'), async (req, res) => {
  try {
    // Check and expire duels where 24h passed
    const now = new Date();
    await Duel.updateMany(
      { status: 'pending', expiresAt: { $lt: now } },
      { status: 'expired' }
    );

    const duels = await Duel.find({
      $or: [{ challenger: req.user.id }, { challenged: req.user.id }]
    })
      .populate('challenger', 'name level')
      .populate('challenged', 'name level')
      .populate('quiz', 'title')
      .populate('winner', 'name')
      .sort({ createdAt: -1 });

    res.json(duels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete duel (for the challenged player)
router.post('/:id/complete', auth('student'), async (req, res) => {
  const { score } = req.body;
  try {
    const duel = await Duel.findById(req.params.id);
    if (!duel) {
      return res.status(404).json({ message: 'Duel not found' });
    }

    if (duel.status !== 'pending') {
      return res.status(400).json({ message: 'Duel is no longer active' });
    }

    if (duel.challenged.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to submit for this challenge' });
    }

    duel.challengedScore = score;
    duel.challengedCompleted = true;
    duel.status = 'completed';

    // Determine winner
    if (duel.challengerScore > score) {
      duel.winner = duel.challenger;
    } else if (score > duel.challengerScore) {
      duel.winner = duel.challenged;
    } // If draw, duel.winner is undefined (tied game)

    await duel.save();
    res.json(duel);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
