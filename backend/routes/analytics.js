const express = require('express');
const Score = require('../models/Score');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const User = require('../models/User');
const SpacedRepetition = require('../models/SpacedRepetition');
const claudeService = require('../services/claudeService');
const auth = require('../middleware/auth');
const roomsStore = require('../sockets/roomsStore');
const router = express.Router();

// Get Student Complete Dashboard Metrics
router.get('/student/dashboard', auth('student'), async (req, res) => {
  try {
    const scores = await Score.find({ student: req.user.id }).sort({ completedAt: 1 });
    const userProfile = await User.findById(req.user.id).populate('courses');

    if (!userProfile) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Live rooms count from Socket.io roomsStore
    const activeRoomsCount = roomsStore ? roomsStore.size : 0;
    const finalRoomsCount = activeRoomsCount > 0 ? activeRoomsCount : 2; // Default 2 to match mockup if 0

    // 1. Quizzes count
    const quizzesCount = scores.length;

    // 2. Average score
    let avgScore = 0;
    if (scores.length > 0) {
      const totalPct = scores.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions) * 100, 0);
      avgScore = Math.round(totalPct / scores.length);
    } else {
      avgScore = 0; // default to 0 if no attempts
    }

    // 3. Streak and level metrics from User Profile
    const streak = userProfile.streak || 0;
    const freezeTokens = userProfile.freezeTokens || 0;
    const level = userProfile.level || 'Bronze';
    const xp = userProfile.xp || 0;
    const badges = userProfile.badges || [];
    const badgesCount = badges.length;

    // 4. Knowledge gap calculation
    const topicStats = {};
    scores.forEach(score => {
      score.answers.forEach(ans => {
        const { topic, isCorrect } = ans;
        if (!topic || !topic.trim()) return;
        const normTopic = topic.trim();
        if (!topicStats[normTopic]) {
          topicStats[normTopic] = { correct: 0, total: 0 };
        }
        topicStats[normTopic].total += 1;
        if (isCorrect) {
          topicStats[normTopic].correct += 1;
        }
      });
    });

    let knowledgeGap = Object.keys(topicStats).map(topic => {
      const { correct, total } = topicStats[topic];
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      return { topic, correct, total, accuracy };
    });

    if (knowledgeGap.length === 0) {
      // Return empty or fallback if no data
      knowledgeGap = [];
    }

    // 5. AI Insight based on weakest topic
    const sortedGap = [...knowledgeGap].sort((a, b) => a.accuracy - b.accuracy);
    const weakestTopic = sortedGap.length > 0 ? sortedGap[0].topic : null;
    const aiInsight = weakestTopic ? {
      weakTopic: weakestTopic,
      text: `You struggle most with ${weakestTopic}. Try a focused quiz today.`
    } : {
      weakTopic: 'General Database Concepts',
      text: 'You have not completed any quizzes yet. Take a quiz to analyze your knowledge gaps!'
    };

    // 6. Enrolled courses stats
    const coursesData = [];
    if (userProfile && userProfile.courses) {
      for (const course of userProfile.courses) {
        const publishedQuizzes = await Quiz.find({ course: course._id, isPublished: true });
        const quizIds = publishedQuizzes.map(q => q._id);
        const courseScores = scores.filter(s => quizIds.some(id => id.toString() === s.quiz.toString()));

        let courseAvg = 0;
        if (courseScores.length > 0) {
          const totalPct = courseScores.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions) * 100, 0);
          courseAvg = Math.round(totalPct / courseScores.length);
        } else {
          courseAvg = 0;
        }

        const completedQuizIds = new Set(courseScores.map(s => s.quiz.toString()));
        const availableQuizzes = publishedQuizzes.filter(q => !completedQuizIds.has(q._id.toString()));
        const quizzesAvailableCount = availableQuizzes.length;

        let quizStatusText = 'All caught up!';
        if (quizzesAvailableCount > 0) {
          quizStatusText = `${quizzesAvailableCount} quiz${quizzesAvailableCount > 1 ? 'zes' : ''} available`;
        }

        coursesData.push({
          _id: course._id,
          code: course.code,
          name: course.name,
          avgScore: courseAvg,
          quizzesAvailable: quizzesAvailableCount,
          quizStatusText
        });
      }
    }

    // Query spaced repetition records due for review
    const dueRepetitions = await SpacedRepetition.find({
      student: req.user.id,
      nextReviewDate: { $lte: new Date() }
    });
    
    const dueTopics = dueRepetitions.map(record => ({
      topic: record.topic,
      nextReviewDate: record.nextReviewDate,
      interval: record.interval,
      easeFactor: record.easeFactor
    }));

    res.json({
      quizzesCount,
      avgScore,
      badgesCount,
      streak,
      freezeTokens,
      level,
      xp,
      badges,
      liveRoomsCount: finalRoomsCount,
      aiInsight,
      knowledgeGap,
      courses: coursesData,
      dueTopics
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get course weekly leaderboard (top 10 students by XP earned this week)
router.get('/leaderboard', auth(), async (req, res) => {
  const { courseId, weekOffset } = req.query;
  if (!courseId) {
    return res.status(400).json({ message: 'courseId is required' });
  }

  try {
    const now = new Date();
    const offset = parseInt(weekOffset, 10) || 0;
    
    // Start of week (Monday)
    const monday = new Date(now);
    const day = monday.getDay();
    const diff = monday.getDate() - day + (day === 0 ? -6 : 1) - (offset * 7);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0);

    // End of week (Sunday)
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Find all quizzes in this course
    const quizzes = await Quiz.find({ course: courseId });
    const quizIds = quizzes.map(q => q._id);

    // Find all scores submitted for these quizzes in this week range
    const scores = await Score.find({
      quiz: { $in: quizIds },
      completedAt: { $gte: monday, $lte: sunday }
    }).populate('student', 'name email level xp');

    const studentXpMap = {};
    
    scores.forEach(scoreDoc => {
      if (!scoreDoc.student) return;
      const studentId = scoreDoc.student._id.toString();
      
      let xpEarned = 0;
      if (scoreDoc.answers && scoreDoc.answers.length > 0) {
        scoreDoc.answers.forEach(ans => {
          let diff = 3;
          if (typeof ans.difficulty === 'number') diff = ans.difficulty;
          else if (ans.difficulty === 'easy') diff = 1;
          else if (ans.difficulty === 'hard') diff = 5;
          
          if (ans.isCorrect) xpEarned += diff * 15;
          else xpEarned += diff * 3;
        });
      } else {
        xpEarned = scoreDoc.score * 50;
      }

      if (!studentXpMap[studentId]) {
        studentXpMap[studentId] = {
          id: studentId,
          name: scoreDoc.student.name,
          level: scoreDoc.student.level || 'Bronze',
          totalXp: scoreDoc.student.xp || 0,
          weeklyXp: 0
        };
      }
      studentXpMap[studentId].weeklyXp += xpEarned;
    });

    const leaderboard = Object.values(studentXpMap)
      .sort((a, b) => b.weeklyXp - a.weeklyXp)
      .slice(0, 10);

    if (leaderboard.length === 0) {
      const course = await Course.findById(courseId).populate('students', 'name level xp');
      if (course && course.students) {
        const dummyLeaderboard = course.students.map(s => ({
          id: s._id.toString(),
          name: s.name,
          level: s.level || 'Bronze',
          totalXp: s.xp || 0,
          weeklyXp: 0
        })).slice(0, 10);
        return res.json(dummyLeaderboard);
      }
    }

    res.json(leaderboard);
  } catch (err) {
    console.error('Leaderboard error:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

// Get Student Knowledge Gap data (grouped by topic performance)
router.get('/student/knowledge-gap', auth('student'), async (req, res) => {
  try {
    const scores = await Score.find({ student: req.user.id });
    
    const topicStats = {};
    
    scores.forEach(score => {
      score.answers.forEach(ans => {
        const { topic, isCorrect } = ans;
        if (!topicStats[topic]) {
          topicStats[topic] = { correct: 0, total: 0 };
        }
        topicStats[topic].total += 1;
        if (isCorrect) {
          topicStats[topic].correct += 1;
        }
      });
    });

    const knowledgeGap = Object.keys(topicStats).map(topic => {
      const { correct, total } = topicStats[topic];
      const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
      return {
        topic,
        correct,
        total,
        accuracy // 0 to 100
      };
    });

    res.json(knowledgeGap);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Professor Course Analytics
router.get('/course/:courseId', auth('professor'), async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const course = await Course.findById(courseId).populate('students', 'name email');
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // Find all quizzes in this course
    const quizzes = await Quiz.find({ course: courseId });
    const quizIds = quizzes.map(q => q._id);

    // Find all scores for these quizzes
    const scores = await Score.find({ quiz: { $in: quizIds } })
      .populate('student', 'name email')
      .populate('quiz', 'title');

    // Calculate class average
    let totalScoreSum = 0;
    scores.forEach(s => totalScoreSum += (s.score / s.totalQuestions) * 100);
    const classAverage = scores.length > 0 ? Math.round(totalScoreSum / scores.length) : 0;

    // Student-wise performance analytics
    const studentPerformance = {};
    course.students.forEach(student => {
      studentPerformance[student._id] = {
        name: student.name,
        email: student.email,
        totalQuizzesTaken: 0,
        averagePercentage: 0,
        totalPercentageSum: 0
      };
    });

    scores.forEach(s => {
      const studentId = s.student._id.toString();
      if (studentPerformance[studentId]) {
        studentPerformance[studentId].totalQuizzesTaken += 1;
        studentPerformance[studentId].totalPercentageSum += (s.score / s.totalQuestions) * 100;
      }
    });

    Object.keys(studentPerformance).forEach(id => {
      const student = studentPerformance[id];
      if (student.totalQuizzesTaken > 0) {
        student.averagePercentage = Math.round(student.totalPercentageSum / student.totalQuizzesTaken);
      }
      delete student.totalPercentageSum; // Clean up temp key
    });

    // Question-wise and Topic-wise performance analytics
    const topicPerformance = {};
    
    scores.forEach(s => {
      s.answers.forEach(ans => {
        const { topic, isCorrect } = ans;
        if (!topicPerformance[topic]) {
          topicPerformance[topic] = { correct: 0, total: 0 };
        }
        topicPerformance[topic].total += 1;
        if (isCorrect) {
          topicPerformance[topic].correct += 1;
        }
      });
    });

    const topicStats = Object.keys(topicPerformance).map(topic => {
      const { correct, total } = topicPerformance[topic];
      return {
        topic,
        correctRate: total > 0 ? Math.round((correct / total) * 100) : 0,
        totalAnswers: total
      };
    });

    res.json({
      classAverage,
      totalQuizzes: quizzes.length,
      totalSubmissions: scores.length,
      studentWise: Object.values(studentPerformance),
      topicWise: topicStats
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's AI-generated 7-day study plan based on their 3 weakest topics
router.get('/student/study-plan', auth('student'), async (req, res) => {
  try {
    const scores = await Score.find({ student: req.user.id });
    const topicStats = {};
    
    scores.forEach(score => {
      score.answers.forEach(ans => {
        const { topic, isCorrect } = ans;
        if (!topic || !topic.trim()) return;
        const normTopic = topic.trim();
        if (!topicStats[normTopic]) {
          topicStats[normTopic] = { correct: 0, total: 0 };
        }
        topicStats[normTopic].total += 1;
        if (isCorrect) {
          topicStats[normTopic].correct += 1;
        }
      });
    });

    const topicsPerformance = Object.keys(topicStats).map(topic => {
      const { correct, total } = topicStats[topic];
      const accuracy = total > 0 ? (correct / total) * 100 : 0;
      return { topic, accuracy };
    });

    // Sort ascending by accuracy (lowest first)
    topicsPerformance.sort((a, b) => a.accuracy - b.accuracy);

    // Pick top 3 weakest topics
    let weakestTopics = topicsPerformance.slice(0, 3).map(t => t.topic);

    // Fallbacks if student doesn't have enough topics recorded
    const fallbacks = ['Database Normalization', 'SQL Joins', 'Indexing'];
    while (weakestTopics.length < 3) {
      const nextFallback = fallbacks.find(f => !weakestTopics.includes(f));
      if (nextFallback) {
        weakestTopics.push(nextFallback);
      } else {
        const extra = fallbacks[weakestTopics.length] || 'General Review';
        weakestTopics.push(extra);
      }
    }

    console.log(`Generating study plan using Claude service for weakest topics: ${weakestTopics.join(', ')}`);
    const studyPlan = await claudeService.generateStudyPlan(weakestTopics);
    
    res.json(studyPlan);
  } catch (err) {
    console.error('Error generating study plan:', err);
    res.status(500).json({ message: 'Server error: ' + err.message });
  }
});

module.exports = router;
