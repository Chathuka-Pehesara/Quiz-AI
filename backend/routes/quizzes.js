const express = require('express');
const Quiz = require('../models/Quiz');
const Course = require('../models/Course');
const Score = require('../models/Score');
const User = require('../models/User');
const Group = require('../models/Group');
const claude = require('../services/claudeService');
const UserCourseDifficulty = require('../models/UserCourseDifficulty');
const SpacedRepetition = require('../models/SpacedRepetition');
const UserQuizMapping = require('../models/UserQuizMapping');
const auth = require('../middleware/auth');
const router = express.Router();

// Helper to shuffle topics and MCQ choices order per student/quiz
async function getOrCreateUserQuizMapping(studentId, quiz) {
  let mapping = await UserQuizMapping.findOne({ student: studentId, quiz: quiz._id });
  if (!mapping) {
    const topicMap = {};
    quiz.questions.forEach(q => {
      if (!q.topic) return;
      const t = q.topic.trim();
      if (!topicMap[t]) {
        topicMap[t] = [];
      }
      topicMap[t].push(q);
    });
    const originalTopics = Object.keys(topicMap);
    
    // Shuffle topics/question order
    const shuffledTopics = [...originalTopics].sort(() => Math.random() - 0.5);

    // Shuffle options for MCQ questions
    const shuffledQuestions = [];
    quiz.questions.forEach(q => {
      if (q.type === 'mcq' && q.options && q.options.length > 0) {
        const shuffledOptions = [...q.options].sort(() => Math.random() - 0.5);
        shuffledQuestions.push({
          questionId: q._id.toString(),
          shuffledOptions
        });
      }
    });

    mapping = new UserQuizMapping({
      student: studentId,
      quiz: quiz._id,
      shuffledTopics,
      shuffledQuestions
    });
    await mapping.save();
  }
  return mapping;
}


// Generate quiz questions (Professor only)
router.post('/generate', auth('professor'), async (req, res) => {
  const { title, courseId, textInput, numQuestions, timeLimit } = req.body;
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
      isPublished: false,
      timeLimit: timeLimit || 10
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

    // If student, apply shuffling mapping!
    if (req.user && req.user.role === 'student') {
      const mapping = await getOrCreateUserQuizMapping(req.user.id, quiz);
      
      // Reorder questions list and shuffle options
      // Group questions by topic first
      const topicMap = {};
      quiz.questions.forEach(q => {
        if (!q.topic) return;
        const t = q.topic.trim();
        if (!topicMap[t]) topicMap[t] = [];
        topicMap[t].push(q);
      });

      // Map and reorder questions based on shuffledTopics
      const quizObj = quiz.toObject ? quiz.toObject() : JSON.parse(JSON.stringify(quiz));
      const reorderedQuestions = [];
      
      mapping.shuffledTopics.forEach(topic => {
        const qsForTopic = topicMap[topic] || [];
        qsForTopic.forEach(q => {
          const qObj = q.toObject ? q.toObject() : JSON.parse(JSON.stringify(q));
          if (qObj.type === 'mcq') {
            const mappedQ = mapping.shuffledQuestions.find(sq => sq.questionId === qObj._id.toString());
            if (mappedQ && mappedQ.shuffledOptions && mappedQ.shuffledOptions.length > 0) {
              qObj.options = mappedQ.shuffledOptions;
            }
          }
          reorderedQuestions.push(qObj);
        });
      });

      // If there are any questions with no topic or missing, add them too
      quiz.questions.forEach(q => {
        const qObj = q.toObject ? q.toObject() : JSON.parse(JSON.stringify(q));
        if (!reorderedQuestions.some(rq => rq._id.toString() === qObj._id.toString())) {
          if (qObj.type === 'mcq') {
            const mappedQ = mapping.shuffledQuestions.find(sq => sq.questionId === qObj._id.toString());
            if (mappedQ && mappedQ.shuffledOptions && mappedQ.shuffledOptions.length > 0) {
              qObj.options = mappedQ.shuffledOptions;
            }
          }
          reorderedQuestions.push(qObj);
        }
      });

      quizObj.questions = reorderedQuestions;
      return res.json(quizObj);
    }

    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update quiz questions/details (Professor review/edit)
router.put('/:id', auth('professor'), async (req, res) => {
  const { title, questions, timeLimit } = req.body;
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
    if (timeLimit !== undefined) quiz.timeLimit = timeLimit;

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

    // Broadcast to course channel
    const io = req.app.get('io');
    if (io) {
      io.to(quiz.course.toString()).emit('activity_feed_event', {
        type: 'quiz_published',
        quizId: quiz._id,
        quizTitle: quiz.title,
        createdAt: new Date()
      });
    }

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
  const { score, totalQuestions, answers, timeTaken, hintsUsed } = req.body;
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) {
      return res.status(404).json({ message: 'Quiz not found' });
    }

    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    const newScore = new Score({
      student: req.user.id,
      quiz: req.params.id,
      score,
      totalQuestions,
      answers
    });

    await newScore.save();

    // 1. XP and Level System
    let xpEarned = 0;
    if (answers && answers.length > 0) {
      answers.forEach(ans => {
        let diff = 3; // Default difficulty
        if (typeof ans.difficulty === 'number') {
          diff = ans.difficulty;
        } else if (typeof ans.difficulty === 'string') {
          const parsed = parseInt(ans.difficulty, 10);
          if (!isNaN(parsed)) diff = parsed;
          else if (ans.difficulty.toLowerCase() === 'easy') diff = 1;
          else if (ans.difficulty.toLowerCase() === 'medium') diff = 3;
          else if (ans.difficulty.toLowerCase() === 'hard') diff = 5;
        }
        
        if (ans.isCorrect) {
          xpEarned += diff * 15; // correct answer XP
        } else {
          xpEarned += diff * 3; // participation/incorrect XP
        }
      });
    } else {
      xpEarned = score * 50;
    }

    const previousXp = student.xp || 0;
    student.xp = previousXp + xpEarned;

    let currentLevel = 'Bronze';
    if (student.xp > 4000) currentLevel = 'Genius';
    else if (student.xp > 1500) currentLevel = 'Gold';
    else if (student.xp > 500) currentLevel = 'Silver';

    const levelUp = currentLevel !== student.level;
    student.level = currentLevel;

    // 2. Daily Streak System
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    let currentStreak = student.streak || 0;
    let freezeTokens = student.freezeTokens || 0;
    let streakProtected = false;

    if (student.lastActiveDate) {
      const lastActive = new Date(student.lastActiveDate);
      lastActive.setUTCHours(0, 0, 0, 0);

      const diffTime = Math.abs(today - lastActive);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak += 1;
        // Earn 1 freeze token every 7-day streak
        if (currentStreak > 0 && currentStreak % 7 === 0) {
          freezeTokens += 1;
        }
      } else if (diffDays === 0) {
        // Keep streak same
      } else {
        // Missed at least a day
        if (freezeTokens > 0) {
          freezeTokens -= 1;
          streakProtected = true;
          currentStreak += 1; // streak protected and continued
          if (currentStreak > 0 && currentStreak % 7 === 0) {
            freezeTokens += 1;
          }
        } else {
          currentStreak = 1; // Reset streak
        }
      }
    } else {
      currentStreak = 1;
    }

    student.streak = currentStreak;
    student.freezeTokens = freezeTokens;
    student.lastActiveDate = new Date();

    // 3. Active Times Tracking
    const currentHour = new Date().getHours();
    if (!student.activeTimes) student.activeTimes = [];
    const activeHourObj = student.activeTimes.find(h => h.hour === currentHour);
    if (!activeHourObj) {
      student.activeTimes.push({ hour: currentHour, count: 1 });
    } else {
      activeHourObj.count += 1;
    }

    // 4. Badge and Achievement System
    const BADGE_DEFS = {
      first_quiz: { name: 'First Quiz', icon: '🚀', description: 'Completed your very first quiz attempt!' },
      seven_streak: { name: '7-Day Streak', icon: '🔥', description: 'Maintained a quiz streak for 7 consecutive days!' },
      thirty_streak: { name: '30-Day Streak', icon: '⚡', description: 'Maintained a quiz streak for 30 consecutive days!' },
      perfect_score: { name: 'Perfect Score', icon: '🏆', description: 'Scored 100% on a quiz!' },
      speed_demon: { name: 'Speed Demon', icon: '🏎️', description: 'Completed a quiz in under half the estimated time!' },
      top_of_class: { name: 'Top of Class', icon: '🥇', description: 'Got the highest score on a quiz!' },
      night_owl: { name: 'Night Owl', icon: '🦉', description: 'Completed a quiz late night after 10 PM!' },
      subject_master: { name: 'Subject Master', icon: '👑', description: 'Maintained 90%+ accuracy in a topic across 5 quizzes!' },
      battle_winner: { name: 'Battle Winner', icon: '⚔️', description: 'Won a live multiplayer quiz battle!' },
      comeback_king: { name: 'Comeback King', icon: '👑', description: 'Improved your score by 30% or more compared to your last attempt!' },
      century: { name: 'Century Club', icon: '💯', description: 'Completed 100 quizzes on the platform!' },
      ai_whiz: { name: 'AI Whiz', icon: '🧠', description: 'Used a hint and still answered the question correctly!' }
    };

    const badgesUnlocked = [];
    const existingBadgeNames = new Set((student.badges || []).map(b => b.name));

    const checkAndAwardBadge = (badgeKey) => {
      const def = BADGE_DEFS[badgeKey];
      if (def && !existingBadgeNames.has(def.name)) {
        if (!student.badges) student.badges = [];
        student.badges.push({ name: def.name, icon: def.icon, description: def.description });
        badgesUnlocked.push(def);
      }
    };

    const scoresCount = await Score.countDocuments({ student: req.user.id });

    // Badge 1: First Quiz
    if (scoresCount <= 1) {
      checkAndAwardBadge('first_quiz');
    }

    // Badge 2 & 3: Streaks
    if (currentStreak >= 7) checkAndAwardBadge('seven_streak');
    if (currentStreak >= 30) checkAndAwardBadge('thirty_streak');

    // Badge 4: Perfect Score
    const currentPct = (score / totalQuestions) * 100;
    if (currentPct === 100) {
      checkAndAwardBadge('perfect_score');
    }

    // Badge 5: Speed Demon
    const estTimeLimit = totalQuestions * 30; // 30s per question
    if (timeTaken && timeTaken < (estTimeLimit / 2)) {
      checkAndAwardBadge('speed_demon');
    }

    // Badge 6: Top of Class
    const otherScores = await Score.findOne({ quiz: quiz._id, score: { $gt: score } });
    if (!otherScores) {
      checkAndAwardBadge('top_of_class');
    }

    // Badge 7: Night Owl
    if (currentHour >= 22 || currentHour < 4) {
      checkAndAwardBadge('night_owl');
    }

    // Badge 8: Century
    if (scoresCount >= 100) {
      checkAndAwardBadge('century');
    }

    // Badge 9: AI Whiz
    let usedHintAndCorrect = false;
    if (hintsUsed && Array.isArray(hintsUsed) && hintsUsed.length > 0 && answers) {
      usedHintAndCorrect = answers.some(ans => 
        ans.isCorrect && ans.questionId && hintsUsed.includes(ans.questionId.toString())
      );
    }
    if (usedHintAndCorrect) {
      checkAndAwardBadge('ai_whiz');
    }

    // Badge 10: Battle Winner
    if (req.body.isBattleWinner) {
      checkAndAwardBadge('battle_winner');
    }

    // Badge 11: Comeback King
    const scoresList = await Score.find({ student: req.user.id }).sort({ completedAt: -1 }).limit(2);
    if (scoresList.length > 1) {
      const lastScoreObj = scoresList[1]; // Index 1 is the previous quiz score (since Index 0 is the current saved score)
      const lastPct = (lastScoreObj.score / lastScoreObj.totalQuestions) * 100;
      if (currentPct - lastPct >= 30) {
        checkAndAwardBadge('comeback_king');
      }
    }

    // Badge 12: Subject Master (90%+ on a topic across 5 quizzes)
    const allScores = await Score.find({ student: req.user.id });
    const topicQuizScores = {}; // topic -> { quizId -> { correct: 0, total: 0 } }
    allScores.forEach(s => {
      const quizKey = s.quiz ? s.quiz.toString() : 'mock_quiz';
      if (s.answers) {
        s.answers.forEach(ans => {
          if (!ans.topic) return;
          const topicName = ans.topic.trim();
          if (!topicQuizScores[topicName]) topicQuizScores[topicName] = {};
          if (!topicQuizScores[topicName][quizKey]) {
            topicQuizScores[topicName][quizKey] = { correct: 0, total: 0 };
          }
          topicQuizScores[topicName][quizKey].total += 1;
          if (ans.isCorrect) {
            topicQuizScores[topicName][quizKey].correct += 1;
          }
        });
      }
    });

    let isSubjectMaster = false;
    for (const topicName of Object.keys(topicQuizScores)) {
      let highAccCount = 0;
      const qMap = topicQuizScores[topicName];
      for (const quizKey of Object.keys(qMap)) {
        const stats = qMap[quizKey];
        if (stats.total > 0 && (stats.correct / stats.total) >= 0.9) {
          highAccCount += 1;
        }
      }
      if (highAccCount >= 5) {
        isSubjectMaster = true;
        break;
      }
    }
    if (isSubjectMaster) {
      checkAndAwardBadge('subject_master');
    }

    await student.save();

    // Spaced Repetition Scheduling (SM-2 algorithm)
    if (answers && answers.length > 0) {
      const topicResults = {};
      answers.forEach(ans => {
        if (!ans.topic) return;
        const topicName = ans.topic.trim();
        if (!topicResults[topicName]) {
          topicResults[topicName] = { correct: 0, total: 0 };
        }
        topicResults[topicName].total += 1;
        if (ans.isCorrect) {
          topicResults[topicName].correct += 1;
        }
      });

      for (const topic of Object.keys(topicResults)) {
        const stats = topicResults[topic];
        const accuracy = (stats.correct / stats.total) * 100;
        
        let q = 0;
        if (accuracy === 100) q = 5;
        else if (accuracy >= 80) q = 4;
        else if (accuracy >= 60) q = 3;
        else if (accuracy >= 40) q = 2;
        else if (accuracy >= 20) q = 1;
        else q = 0;

        let record = await SpacedRepetition.findOne({
          student: req.user.id,
          course: quiz.course,
          topic
        });

        if (!record) {
          record = new SpacedRepetition({
            student: req.user.id,
            course: quiz.course,
            topic,
            easeFactor: 2.5,
            interval: 0,
            repetitionCount: 0
          });
        }

        if (q >= 3) {
          if (record.repetitionCount === 0) {
            record.interval = 1;
          } else if (record.repetitionCount === 1) {
            record.interval = 6;
          } else {
            record.interval = Math.round(record.interval * record.easeFactor);
          }
          record.repetitionCount += 1;
        } else {
          record.repetitionCount = 0;
          record.interval = 1;
        }

        record.easeFactor = record.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02));
        if (record.easeFactor < 1.3) {
          record.easeFactor = 1.3;
        }

        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + record.interval);
        record.nextReviewDate = reviewDate;

        await record.save();
      }
    }

    // Update study groups where student is a member with this completed quiz
    try {
      await Group.updateMany(
        { members: req.user.id },
        {
          $push: {
            quizzes: {
              student: req.user.id,
              quizTitle: quiz.title,
              score,
              totalQuestions,
              completedAt: new Date()
            }
          }
        }
      );
    } catch (groupErr) {
      console.error('Error updating study group quiz history:', groupErr);
    }

    // Broadcast to course channel via Socket.io
    const io = req.app.get('io');
    if (io) {
      io.to(quiz.course.toString()).emit('activity_feed_event', {
        type: 'quiz_completed',
        studentName: student.name,
        quizTitle: quiz.title,
        score,
        totalQuestions,
        createdAt: new Date()
      });

      if (badgesUnlocked && badgesUnlocked.length > 0) {
        badgesUnlocked.forEach(badge => {
          io.to(quiz.course.toString()).emit('activity_feed_event', {
            type: 'badge_unlocked',
            studentName: student.name,
            badgeName: badge.name,
            badgeIcon: badge.icon,
            createdAt: new Date()
          });
        });
      }
    }

    res.status(201).json({
      score: newScore,
      xpEarned,
      totalXp: student.xp,
      level: student.level,
      levelUp,
      streak: student.streak,
      freezeTokens: student.freezeTokens,
      streakProtected,
      badgesUnlocked
    });
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

    // Update topic difficulty in UserCourseDifficulty based on the last answer attempt
    if (answers && answers.length > 0) {
      const lastAnswer = answers[answers.length - 1];
      if (lastAnswer.topic) {
        const topicName = lastAnswer.topic.trim();
        
        let userDiff = await UserCourseDifficulty.findOne({
          student: req.user.id,
          course: quiz.course
        });
        
        if (!userDiff) {
          userDiff = new UserCourseDifficulty({
            student: req.user.id,
            course: quiz.course,
            topicDifficulties: []
          });
        }
        
        let topicDiff = userDiff.topicDifficulties.find(
          td => td.topic.toLowerCase() === topicName.toLowerCase()
        );
        
        if (!topicDiff) {
          userDiff.topicDifficulties.push({
            topic: topicName,
            difficulty: 3,
            attempts: 0,
            correctAttempts: 0
          });
          topicDiff = userDiff.topicDifficulties[userDiff.topicDifficulties.length - 1];
        }
        
        topicDiff.attempts += 1;
        if (lastAnswer.isCorrect) {
          topicDiff.correctAttempts += 1;
        }
        
        const accuracy = (topicDiff.correctAttempts / topicDiff.attempts) * 100;
        
        if (accuracy < 60) {
          topicDiff.difficulty = Math.max(1, topicDiff.difficulty - 1);
        } else if (accuracy > 85) {
          topicDiff.difficulty = Math.min(5, topicDiff.difficulty + 1);
        }
        
        await userDiff.save();
      }
    }

    // 1. Group questions by topic
    const topicMap = {};
    questions.forEach(q => {
      if (!q.topic) return;
      const t = q.topic.trim();
      if (!topicMap[t]) {
        topicMap[t] = [];
      }
      topicMap[t].push(q);
    });

    const mapping = await getOrCreateUserQuizMapping(req.user.id, quiz);
    const topicsList = mapping.shuffledTopics;

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

    if (!topicQuestions || topicQuestions.length === 0) {
      return res.status(400).json({ message: `No questions found for topic ${nextTopic}` });
    }

    // Find active difficulty tier for this topic
    let targetDifficulty = 3;
    const userDiffRecord = await UserCourseDifficulty.findOne({
      student: req.user.id,
      course: quiz.course
    });
    
    if (userDiffRecord) {
      const topicDiffRecord = userDiffRecord.topicDifficulties.find(
        td => td.topic.toLowerCase() === nextTopic.toLowerCase()
      );
      if (topicDiffRecord) {
        targetDifficulty = topicDiffRecord.difficulty;
      }
    }

    // Select the question for nextTopic closest in difficulty to targetDifficulty
    let chosenQuestion = null;
    let minDiff = Infinity;
    
    topicQuestions.forEach(q => {
      let qDiff = 3;
      if (typeof q.difficulty === 'number') {
        qDiff = q.difficulty;
      } else if (typeof q.difficulty === 'string') {
        const parsed = parseInt(q.difficulty, 10);
        if (!isNaN(parsed)) {
          qDiff = parsed;
        } else if (q.difficulty.toLowerCase() === 'easy') {
          qDiff = 1;
        } else if (q.difficulty.toLowerCase() === 'medium') {
          qDiff = 3;
        } else if (q.difficulty.toLowerCase() === 'hard') {
          qDiff = 5;
        }
      }
      const diff = Math.abs(qDiff - targetDifficulty);
      if (diff < minDiff) {
        minDiff = diff;
        chosenQuestion = q;
      }
    });

    let responseQuestion = chosenQuestion;
    if (chosenQuestion && chosenQuestion.type === 'mcq') {
      const questionObj = chosenQuestion.toObject ? chosenQuestion.toObject() : JSON.parse(JSON.stringify(chosenQuestion));
      const mappedQ = mapping.shuffledQuestions.find(sq => sq.questionId === questionObj._id.toString());
      if (mappedQ && mappedQ.shuffledOptions && mappedQ.shuffledOptions.length > 0) {
        questionObj.options = mappedQ.shuffledOptions;
      }
      responseQuestion = questionObj;
    }

    res.json({
      completed: false,
      question: responseQuestion,
      topicIndex: answeredCount,
      totalTopics: topicsList.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add hint engine endpoint
router.post('/hint', auth(), async (req, res) => {
  const { questionText } = req.body;
  if (!questionText) {
    return res.status(400).json({ message: 'questionText is required' });
  }
  try {
    const hint = await claude.generateHint(questionText);
    res.json({ hint });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error: ' + err.message });
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

// AI anti-cheat engine endpoint
router.post('/:id/anti-cheat', auth('student'), async (req, res) => {
  const { timings, answerSequence, appStateChanges } = req.body;
  try {
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    if (!timings || !Array.isArray(timings) || timings.length === 0) {
      return res.status(400).json({ message: 'Invalid or missing timings telemetry.' });
    }

    // 1. Programmatic Checks
    let flagged = false;
    let reasons = [];

    // Rule A: average time per question is under 4 seconds
    const totalTime = timings.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / timings.length;
    if (avgTime < 4) {
      flagged = true;
      reasons.push(`Average time per question was ${avgTime.toFixed(1)}s (under 4s threshold)`);
    }

    // Rule B: all answers were submitted within 10% of each other in timing
    if (timings.length > 1) {
      const within10Percent = timings.every(t => Math.abs(t - avgTime) / avgTime <= 0.10);
      if (within10Percent) {
        flagged = true;
        reasons.push(`Sub-10% timing variation detected (highly uniform response times: ${JSON.stringify(timings)}s)`);
      }
    }

    // Rule C: student switched away from the app more than 3 times
    if (appStateChanges > 3) {
      flagged = true;
      reasons.push(`Student exited/switched focus away from the app ${appStateChanges} times (threshold: 3)`);
    }

    // 2. Claude Integrity Analysis (as requested: "calls Claude to analyse the pattern")
    const claudeResult = await claude.analyzeCheatPattern(timings, answerSequence, appStateChanges);
    if (claudeResult && claudeResult.cheatingSuspected) {
      flagged = true;
      reasons.push(`Claude integrity analysis: ${claudeResult.reason}`);
    }

    // 3. Save flag with reason to MongoDB User document
    if (flagged) {
      student.isFlagged = true;
      student.flagReason = `AI detected cheating: ${reasons.join(' | ')}`;
      await student.save();
      
      console.log(`[ANTI-CHEAT] Student ${student.name} flagged. Reason: ${student.flagReason}`);
    }

    res.json({
      flagged,
      reason: student.flagReason || '',
      claudeAnalysis: claudeResult ? claudeResult.reason : 'Claude API disabled'
    });
  } catch (err) {
    console.error('Anti-cheat endpoint error:', err);
    res.status(500).json({ message: 'Server error analyzing quiz patterns' });
  }
});

module.exports = router;
