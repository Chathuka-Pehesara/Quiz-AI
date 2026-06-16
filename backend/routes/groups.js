const express = require('express');
const Group = require('../models/Group');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Create study group
router.post('/create', auth('student'), async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'Group name is required' });
  }

  try {
    const group = new Group({
      name,
      createdBy: req.user.id,
      members: [req.user.id]
    });
    await group.save();
    res.status(201).json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Invite a classmate by username
router.post('/:id/invite', auth('student'), async (req, res) => {
  const { username } = req.body;
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.includes(req.user.id)) {
      return res.status(403).json({ message: 'Not authorized to invite to this group' });
    }

    const invitedUser = await User.findOne({ name: new RegExp(`^${username.trim()}$`, 'i'), role: 'student' });
    if (!invitedUser) {
      return res.status(404).json({ message: 'Classmate username not found' });
    }

    if (group.members.includes(invitedUser._id)) {
      return res.status(400).json({ message: 'User is already a member of this group' });
    }

    group.members.push(invitedUser._id);
    await group.save();
    res.json(group);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's study groups
router.get('/my-groups', auth('student'), async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate('members', 'name level xp')
      .populate('createdBy', 'name');
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get study group dashboard (leaderboard, history, chat history)
router.get('/:id/dashboard', auth('student'), async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name level xp')
      .populate('quizzes.student', 'name');

    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    if (!group.members.some(m => m._id.toString() === req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this study group' });
    }

    // Leaderboard: rank members by their overall XP (already populated)
    const leaderboard = [...group.members].sort((a, b) => b.xp - a.xp);

    // Chat History: Fetch last 50 messages
    const messages = await Message.find({ group: group._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })
      .limit(50);

    res.json({
      id: group._id,
      name: group.name,
      leaderboard,
      quizHistory: group.quizzes.sort((a, b) => b.completedAt - a.completedAt),
      messages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
