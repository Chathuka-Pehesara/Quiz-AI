const express = require('express');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Score = require('../models/Score');
const User = require('../models/User');
const claude = require('../services/claude');
const auth = require('../middleware/auth');
const router = express.Router();

// Generate quiz questions (Professor only)
router.post('/generate', auth('professor'), async (req, res) => {
  const { title, courseId, textInput, numQuestions } = req.body;
  try {
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    console.log(`Generating quiz questions using Claude service for course: ${course.name}`);
    const questions = await claude.generateQuestions(textInput, numQuestions || 5);

    const quiz = new Quiz({
      title,
      course: courseId,
      questions,
      createdBy: req.user.id,
      isPublished: false
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating quiz: ' + err.message });
  }
});

// Get quiz details
router.get('/:id', auth(), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.id || req.params.id)
      .populate('course', 'name code');
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update quiz questions/details (Professor review/edit)
router.put('/:id', auth('professor'), async (req, res) => {
  const { title, questions } = req.body;
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this quiz' });
    }

    if (title) quiz.title = title;
    if (questions) quiz.questions = questions;

    await quiz.save();
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Publish quiz to students
router.patch('/:id/publish', auth('professor'), async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    if (quiz.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to publish this quiz' });
    }

    quiz.isPublished = true;
    await quiz.save();
    res.json({ message: 'Quiz published successfully', quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fetch active quizzes for a course (Student view)
router.get('/course/:courseId', auth(), async (req, res) => {
  try {
    const quizzes = await Quiz.find({
      course: req.params.courseId,
      isPublished: true
    });
    res.json(quizzes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Request wrong answer explanation from Claude
router.post('/explain-wrong', auth(), async (req, res) => {
  const { questionText, correctAnswer, studentAnswer } = req.body;
  try {
    const explanation = await claude.explainWrongAnswer(questionText, correctAnswer, studentAnswer);
    res.json({ explanation });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Submit finished quiz score (Student)
router.post('/:id/submit', auth('student'), async (req, res) => {
  const { score, totalQuestions, answers } = req.body;
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const newScore = new Score({
      student: req.user.id,
      quiz: req.params.id,
      score,
      totalQuestions,
      answers
    });

    await newScore.save();
    res.status(201).json(newScore);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Server-side Adaptive Difficulty Route
// Serves the next question based on the running score and topic transitions
router.post('/:id/adaptive-next', auth('student'), async (req, res) => {
  const { answers } = req.body; // Array of { topic, isCorrect, questionId }
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const questions = quiz.questions;

    // 1. Group questions by topic
    const topicMap = {};
    questions.forEach(q => {
      if (!topicMap[q.topic]) {
        topicMap[q.topic] = [];
      }
      topicMap[q.topic].push(q);
    });

    const topicsList = Object.keys(topicMap);

    // If quiz is empty, return error
    if (topicsList.length === 0) {
      return res.status(400).json({ message: 'Quiz has no questions.' });
    }

    // Determine current index based on how many questions answered
    const answeredCount = answers ? answers.length : 0;

    // If we answered all topics, return quiz completed
    if (answeredCount >= topicsList.length) {
      return res.json({ completed: true });
    }

    // Current topic we need to serve
    const nextTopic = topicsList[answeredCount];
    const topicQuestions = topicMap[nextTopic];

    // Determine difficulty level to serve
    let targetDifficulty = 'medium';
    if (answeredCount > 0) {
      const lastAnswer = answers[answeredCount - 1];
      if (lastAnswer.isCorrect) {
        targetDifficulty = 'hard';
      } else {
        targetDifficulty = 'easy';
      }
    }

    // Try to find question in nextTopic with targetDifficulty
    let chosenQuestion = topicQuestions.find(q => q.difficulty === targetDifficulty);

    // Fallback if no matching difficulty question is generated for this topic
    if (!chosenQuestion) {
      chosenQuestion = topicQuestions.find(q => q.difficulty === 'medium') || topicQuestions[0];
    }

    res.json({
      completed: false,
      question: chosenQuestion,
      topicIndex: answeredCount,
      totalTopics: topicsList.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate focused practice quiz for student's weak topic
router.post('/practice-weak', auth('student'), async (req, res) => {
  const { topic, courseId } = req.body;
  try {
    let finalCourseId = courseId;
    if (!finalCourseId) {
      const user = await User.findById(req.user.id);
      if (user && user.courses && user.courses.length > 0) {
        finalCourseId = user.courses[0];
      } else {
        return res.status(400).json({ message: 'You must be enrolled in at least one course to practice.' });
      }
    }

    // Generate questions for this topic
    const promptText = `Generate a focused quiz about the topic: ${topic}. Focus on key concepts, practical application, and theoretical foundations of ${topic}.`;
    console.log(`Generating focused practice quiz for topic: ${topic}`);
    const questions = await claude.generateQuestions(promptText, 5);
    
    // Override the topic of all generated questions to match the practiced topic
    questions.forEach(q => {
      q.topic = topic;
    });

    const quiz = new Quiz({
      title: `Practice: ${topic}`,
      course: finalCourseId,
      questions,
      createdBy: req.user.id, // Student created it for practice
      isPublished: true // Practice quizzes are immediately available
    });

    await quiz.save();
    res.status(201).json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error generating practice quiz: ' + err.message });
  }
});

module.exports = router;
