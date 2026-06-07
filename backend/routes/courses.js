const express = require('express');
const Course = require('../models/Course');
const User = require('../models/User');
const auth = require('../middleware/auth');
const router = express.Router();

// Create a new course (Professor only)
router.post('/', auth('professor'), async (req, res) => {
  const { name, code } = req.body;
  try {
    let course = await Course.findOne({ code: code.toUpperCase() });
    if (course) {
      return res.status(400).json({ message: 'Course code already exists' });
    }

    course = new Course({
      name,
      code: code.toUpperCase(),
      professor: req.user.id
    });
    await course.save();

    // Add to professor's courses
    await User.findByIdAndUpdate(req.user.id, { $push: { courses: course._id } });

    res.status(201).json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// List all courses (useful to search and join)
router.get('/', auth(), async (req, res) => {
  try {
    const courses = await Course.find()
      .populate('professor', 'name email')
      .select('-students');
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's enrolled or created courses
router.get('/my', auth(), async (req, res) => {
  try {
    let courses;
    if (req.user.role === 'professor') {
      courses = await Course.find({ professor: req.user.id })
        .populate('students', 'name email');
    } else {
      courses = await Course.find({ students: req.user.id })
        .populate('professor', 'name email');
    }
    res.json(courses);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Enroll in a course (Student only)
router.post('/enroll', auth('student'), async (req, res) => {
  const { code } = req.body;
  try {
    const course = await Course.findOne({ code: code.toUpperCase() });
    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    if (course.students.includes(req.user.id)) {
      return res.status(400).json({ message: 'Already enrolled in this course' });
    }

    // Add student to course
    course.students.push(req.user.id);
    await course.save();

    // Add course to student's user profile
    await User.findByIdAndUpdate(req.user.id, { $push: { courses: course._id } });

    res.json({ message: 'Successfully enrolled', course });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
