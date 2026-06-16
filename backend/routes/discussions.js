const express = require('express');
const Discussion = require('../models/Discussion');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Fetch comments for a question
router.get('/:questionId', auth(), async (req, res) => {
  try {
    let thread = await Discussion.findOne({ questionId: req.params.questionId })
      .populate('comments.sender', 'name role');

    if (!thread) {
      return res.json({ comments: [] });
    }

    // Sort comments: pinned first, then upvotes descending, then newest
    const sortedComments = [...thread.comments].sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      const upvotesA = a.upvotes ? a.upvotes.length : 0;
      const upvotesB = b.upvotes ? b.upvotes.length : 0;
      if (upvotesA !== upvotesB) return upvotesB - upvotesA;
      
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json({ comments: sortedComments });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Post a comment under a question thread
router.post('/:questionId/comment', auth(), async (req, res) => {
  const { text, quizId } = req.body;
  if (!text) {
    return res.status(400).json({ message: 'Comment text is required' });
  }

  try {
    let thread = await Discussion.findOne({ questionId: req.params.questionId });
    if (!thread) {
      if (!quizId) {
        return res.status(400).json({ message: 'quizId is required to start a new discussion thread' });
      }
      thread = new Discussion({
        questionId: req.params.questionId,
        quizId,
        comments: []
      });
    }

    const isProfessor = req.user.role === 'professor';

    thread.comments.push({
      sender: req.user.id,
      text,
      isPinned: isProfessor,
      upvotes: []
    });

    await thread.save();
    
    const updatedThread = await Discussion.findOne({ questionId: req.params.questionId })
      .populate('comments.sender', 'name role');

    res.status(201).json(updatedThread.comments[updatedThread.comments.length - 1]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Toggle upvote a comment
router.post('/:questionId/comment/:commentId/upvote', auth(), async (req, res) => {
  try {
    const thread = await Discussion.findOne({ questionId: req.params.questionId });
    if (!thread) {
      return res.status(404).json({ message: 'Discussion thread not found' });
    }

    const comment = thread.comments.id(req.params.commentId);
    if (!comment) {
      return res.status(404).json({ message: 'Comment not found' });
    }

    if (!comment.upvotes) {
      comment.upvotes = [];
    }

    const index = comment.upvotes.indexOf(req.user.id);
    if (index === -1) {
      comment.upvotes.push(req.user.id);
    } else {
      comment.upvotes.splice(index, 1);
    }

    await thread.save();
    res.json(comment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
