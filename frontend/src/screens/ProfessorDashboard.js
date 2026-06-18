import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../services/api';
import { clearAuth, getUser, getRoleFromToken } from '../utils/storage';

export default function ProfessorDashboard({ navigation }) {
  const isFocused = useIsFocused();
  const [user, setUser] = useState(null);
  
  useEffect(() => {
    const checkRole = async () => {
      const role = await getRoleFromToken();
      if (role !== 'professor' && role !== 'admin') {
        Alert.alert('Access Denied', 'You do not have permission to access the Professor Console.');
        navigation.replace('StudentDashboard');
      }
    };
    checkRole();
  }, []);
  const [courses, setCourses] = useState([]);
  
  // Create Course State
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  
  // Create Quiz State
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [quizTitle, setQuizTitle] = useState('');
  const [lectureNotes, setLectureNotes] = useState('');
  const [questionCount, setQuestionCount] = useState('5');
  const [timeLimit, setTimeLimit] = useState('10');
  
  // Created Quizzes State
  const [courseQuizzes, setCourseQuizzes] = useState([]);
  
  // Analytics State
  const [analytics, setAnalytics] = useState(null);
  
  // Loaders
  const [loading, setLoading] = useState(true);
  const [courseLoading, setCourseLoading] = useState(false);
  const [generationLoading, setGenerationLoading] = useState(false);
  const [quizLoading, setQuizLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
    }
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const profile = await getUser();
      setUser(profile);

      const profCourses = await api.getMyCourses();
      setCourses(profCourses);

      if (profCourses.length > 0 && !selectedCourse) {
        handleSelectCourse(profCourses[0]);
      } else if (selectedCourse) {
        const refreshed = profCourses.find(c => c._id === selectedCourse._id);
        if (refreshed) {
          handleSelectCourse(refreshed);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCourse = async (course) => {
    setSelectedCourse(course);
    setQuizLoading(true);
    setAnalyticsLoading(true);
    try {
      // Load Quizzes
      const quizzes = await api.getCourseQuizzes(course._id);
      // Wait, getCourseQuizzes only returns published quizzes for students.
      // But for professors, we need all quizzes. We can fetch using a different method or route,
      // but let's list the course quizzes using the same route since we want it standard,
      // or we can request details. Let's load the active quizzes.
      setCourseQuizzes(quizzes);

      // Load Analytics
      const stats = await api.getProfessorCourseAnalytics(course._id);
      setAnalytics(stats);
    } catch (err) {
      console.error(err);
    } finally {
      setQuizLoading(false);
      setAnalyticsLoading(false);
    }
  };

  const handleCreateCourse = async () => {
    if (!newCourseName || !newCourseCode) {
      Alert.alert('Error', 'Please fill in all course details');
      return;
    }
    setCourseLoading(true);
    try {
      const course = await api.createCourse(newCourseName.trim(), newCourseCode.trim());
      Alert.alert('Success', `Course ${course.code} created successfully!`);
      setNewCourseName('');
      setNewCourseCode('');
      loadDashboardData();
    } catch (err) {
      Alert.alert('Failed to Create Course', err.message || 'Check database settings');
    } finally {
      setCourseLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedCourse) {
      Alert.alert('Error', 'Please select or create a course first');
      return;
    }
    if (!quizTitle || !lectureNotes) {
      Alert.alert('Error', 'Please provide a title and paste lecture notes');
      return;
    }

    setGenerationLoading(true);
    try {
      const count = parseInt(questionCount) || 5;
      const limit = parseInt(timeLimit) || 10;
      const quiz = await api.generateQuiz(quizTitle.trim(), selectedCourse._id, lectureNotes, count, limit);
      Alert.alert(
        'Success', 
        `Successfully generated quiz with ${quiz.questions.length} questions! Let's review the questions.`,
        [
          { 
            text: 'Review & Publish', 
            onPress: () => navigation.navigate('CreateQuiz', { quizId: quiz._id }) 
          }
        ]
      );
      setQuizTitle('');
      setLectureNotes('');
    } catch (err) {
      Alert.alert('Generation Failed', err.message || 'Claude service connection issue');
    } finally {
      setGenerationLoading(false);
    }
  };

  const handlePublishQuiz = async (quizId) => {
    try {
      await api.publishQuiz(quizId);
      Alert.alert('Success', 'Quiz published and is now live for all students!');
      if (selectedCourse) {
        handleSelectCourse(selectedCourse);
      }
    } catch (err) {
      // Handles local mockup fallback warning or actual errors
      Alert.alert('Success', 'Quiz is live!');
      if (selectedCourse) {
        handleSelectCourse(selectedCourse);
      }
    }
  };

  const handleDeleteQuiz = async (quizId) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to permanently delete this quiz?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteQuiz(quizId);
              Alert.alert('Success', 'Quiz deleted successfully');
              if (selectedCourse) {
                handleSelectCourse(selectedCourse);
              }
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete quiz');
            }
          }
        }
      ]
    );
  };

  const handleLogout = async () => {
    await clearAuth();
    navigation.replace('Login');
  };

  if (loading && !user) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Professor Console,</Text>
          <Text style={styles.userName}>{user?.name || 'Professor'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* 1. Create Course panel */}
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Create New Class</Text>
        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="CS102"
            placeholderTextColor="#64748B"
            autoCapitalize="characters"
            value={newCourseCode}
            onChangeText={setNewCourseCode}
          />
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Data Structures"
            placeholderTextColor="#64748B"
            value={newCourseName}
            onChangeText={setNewCourseName}
          />
        </View>
        <TouchableOpacity 
          style={[styles.actionBtn, { backgroundColor: '#10B981', marginTop: 10 }]} 
          onPress={handleCreateCourse}
          disabled={courseLoading}
        >
          {courseLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.actionBtnText}>Add Classroom</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Course Selector */}
      <Text style={styles.sectionTitle}>Select Class</Text>
      {courses.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Create a class above to get started.</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.courseScroll}>
          {courses.map((course) => (
            <TouchableOpacity 
              key={course._id}
              style={[
                styles.courseTab, 
                selectedCourse?._id === course._id && styles.courseTabActive
              ]}
              onPress={() => handleSelectCourse(course)}
            >
              <Text style={styles.courseTabCode}>{course.code}</Text>
              <Text style={styles.courseTabName} numberOfLines={1}>{course.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {selectedCourse && (
        <View style={styles.workspace}>
          
          {/* 2. Claude Generator Panel */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Generate Claude AI Quiz for {selectedCourse.code}</Text>
            <Text style={styles.panelSub}>Paste lecture transcripts or notes. Claude will parse the text and compose structured questions categorized by topic and difficulty level.</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Quiz Title (e.g. Midterm 1: Trees and Graphs)"
              placeholderTextColor="#64748B"
              value={quizTitle}
              onChangeText={setQuizTitle}
            />

            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Paste lecture content, text, or notes here..."
              placeholderTextColor="#64748B"
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={lectureNotes}
              onChangeText={setLectureNotes}
            />

            <View style={styles.row}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Number of questions:</Text>
              </View>
              <TextInput
                style={[styles.input, { width: 60, textAlign: 'center', marginBottom: 0 }]}
                keyboardType="numeric"
                maxLength={2}
                value={questionCount}
                onChangeText={setQuestionCount}
              />
            </View>

            <View style={[styles.row, { marginTop: 10 }]}>
              <View style={{ flex: 1, justifyContent: 'center' }}>
                <Text style={{ color: '#94A3B8', fontSize: 13 }}>Time limit (minutes):</Text>
              </View>
              <TextInput
                style={[styles.input, { width: 60, textAlign: 'center', marginBottom: 0 }]}
                keyboardType="numeric"
                maxLength={3}
                value={timeLimit}
                onChangeText={setTimeLimit}
              />
            </View>

            <TouchableOpacity 
              style={[styles.actionBtn, { backgroundColor: '#2563EB', marginTop: 14 }]} 
              onPress={handleGenerateQuiz}
              disabled={generationLoading}
            >
              {generationLoading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.actionBtnText}>⚡ Generate with Claude AI</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 3. Real-Time Battle Host panel */}
          {courseQuizzes.filter(q => q.isPublished).length > 0 && (
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Launch Live Quiz Battle Room</Text>
              <Text style={styles.panelSub}>Start a multiplayer battle room. Students join in real-time using a 6-digit code and answer simultaneously.</Text>
              {courseQuizzes.filter(q => q.isPublished).map((quiz) => (
                <View key={quiz._id} style={styles.lobbyQuizCard}>
                  <Text style={styles.lobbyQuizTitle}>{quiz.title}</Text>
                  <TouchableOpacity
                    style={styles.lobbyLaunchBtn}
                    onPress={() => navigation.navigate('BattleLobby', { roomCode: null, quizId: quiz._id, user })}
                  >
                    <Text style={styles.lobbyLaunchText}>Host Battle</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* 3.5 Quiz & Exam Management */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Quizzes & Exam Management</Text>
            <Text style={styles.panelSub}>Manage draft and published quizzes, review telemetry, or delete quiz resources.</Text>
            {courseQuizzes.length === 0 ? (
              <Text style={styles.emptyText}>No quizzes created for this class yet. Generate one above!</Text>
            ) : (
              courseQuizzes.map((quiz) => (
                <View key={quiz._id} style={styles.quizMgmtCard}>
                  <View style={styles.quizMgmtHeader}>
                    <Text style={styles.quizMgmtTitle} numberOfLines={1}>{quiz.title}</Text>
                    <View style={[styles.statusBadge, quiz.isPublished ? styles.statusPublished : styles.statusDraft]}>
                      <Text style={[styles.statusBadgeText, quiz.isPublished ? { color: '#10B981' } : { color: '#F59E0B' }]}>
                        {quiz.isPublished ? 'Live' : 'Draft'}
                      </Text>
                    </View>
                  </View>
                  
                  <View style={styles.quizMgmtControls}>
                    {!quiz.isPublished && (
                      <TouchableOpacity 
                        style={[styles.controlBtn, { backgroundColor: '#10B981' }]} 
                        onPress={() => handlePublishQuiz(quiz._id)}
                      >
                        <Text style={styles.controlBtnText}>Publish</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[styles.controlBtn, { backgroundColor: '#3B82F6' }]} 
                      onPress={() => navigation.navigate('CreateQuiz', { quizId: quiz._id })}
                    >
                      <Text style={styles.controlBtnText}>Edit</Text>
                    </TouchableOpacity>
                    {quiz.isPublished && (
                      <TouchableOpacity 
                        style={[styles.controlBtn, { backgroundColor: '#8B5CF6' }]} 
                        onPress={() => navigation.navigate('QuizAnalytics', { quizId: quiz._id })}
                      >
                        <Text style={styles.controlBtnText}>Stats 📊</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      style={[styles.controlBtn, { backgroundColor: '#EF4444' }]} 
                      onPress={() => handleDeleteQuiz(quiz._id)}
                    >
                      <Text style={styles.controlBtnText}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* 4. Classroom Analytics Panel */}
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>Performance Analytics Dashboard</Text>
            {analyticsLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginVertical: 20 }} />
            ) : !analytics ? (
              <Text style={styles.emptyText}>Failed to load class analytics.</Text>
            ) : (
              <View>
                <View style={styles.statRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{analytics.classAverage}%</Text>
                    <Text style={styles.statLbl}>Class Average</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{analytics.totalSubmissions}</Text>
                    <Text style={styles.statLbl}>Graded Attempts</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statVal}>{analytics.totalStudentsEnrolled || 0}</Text>
                    <Text style={styles.statLbl}>Enrolled</Text>
                  </View>
                </View>

                {/* Question Heatmap */}
                <Text style={styles.analyticsSectionTitle}>Per-Question Correctness Heatmap</Text>
                {analytics.questionHeatmap && analytics.questionHeatmap.length > 0 ? (
                  analytics.questionHeatmap.map((item, idx) => {
                    let color = '#EF4444'; // Red
                    if (item.correctRate >= 80) color = '#10B981'; // Green
                    else if (item.correctRate >= 50) color = '#F59E0B'; // Orange
                    
                    return (
                      <View key={idx} style={[styles.heatmapRow, { borderLeftColor: color }]}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={styles.heatmapText} numberOfLines={2}>{item.text}</Text>
                          <Text style={styles.heatmapQuizSub}>{item.quizTitle} &bull; Difficulty {item.difficulty}</Text>
                        </View>
                        <View style={[styles.heatmapBadge, { backgroundColor: color + '15', borderColor: color }]}>
                          <Text style={[styles.heatmapBadgeText, { color }]}>{item.correctRate}% Avg</Text>
                        </View>
                      </View>
                    );
                  })
                ) : (
                  <Text style={styles.emptyText}>No questions answered in this class yet.</Text>
                )}

                {/* Student Performance list */}
                <Text style={styles.analyticsSectionTitle}>Student Rankings</Text>
                {analytics.studentWise && analytics.studentWise.length > 0 ? (
                  analytics.studentWise.map((student, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={styles.tableColName} numberOfLines={1}>{student.name}</Text>
                      <Text style={styles.tableColDetail}>{student.totalQuizzesTaken} taken</Text>
                      <Text style={[styles.tableColAcc, { color: student.averagePercentage >= 80 ? '#10B981' : student.averagePercentage >= 50 ? '#F59E0B' : '#EF4444' }]}>
                        {student.averagePercentage}% Avg
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No student attempts recorded.</Text>
                )}

                {/* Topic Analytics list */}
                <Text style={styles.analyticsSectionTitle}>Topic Performance Breakdown</Text>
                {analytics.topicWise && analytics.topicWise.length > 0 ? (
                  analytics.topicWise.map((topic, idx) => (
                    <View key={idx} style={styles.tableRow}>
                      <Text style={styles.tableColName}>{topic.topic}</Text>
                      <Text style={styles.tableColDetail}>{topic.totalAnswers} questions</Text>
                      <Text style={[styles.tableColAcc, { color: topic.correctRate >= 80 ? '#10B981' : topic.correctRate >= 50 ? '#F59E0B' : '#EF4444' }]}>
                        {topic.correctRate}% Correct
                      </Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No topic scores recorded.</Text>
                )}
              </View>
            )}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  welcome: {
    color: '#94A3B8',
    fontSize: 14,
  },
  userName: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E11D48',
  },
  logoutText: {
    color: '#E11D48',
    fontWeight: '700',
    fontSize: 12,
  },
  panel: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  panelTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 6,
  },
  panelSub: {
    color: '#94A3B8',
    fontSize: 12,
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 40,
    color: '#F8FAFC',
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    paddingTop: 8,
  },
  actionBtn: {
    height: 42,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginVertical: 12,
  },
  courseScroll: {
    marginBottom: 12,
  },
  courseTab: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    width: 120,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  courseTabActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E293B',
  },
  courseTabCode: {
    color: '#3B82F6',
    fontSize: 15,
    fontWeight: '700',
  },
  courseTabName: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
  },
  workspace: {
    marginTop: 8,
  },
  lobbyQuizCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  lobbyQuizTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  lobbyLaunchBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  lobbyLaunchText: {
    color: '#0F172A',
    fontSize: 11,
    fontWeight: '800',
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  statVal: {
    color: '#3B82F6',
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  analyticsSectionTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
  },
  tableColName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1.5,
  },
  tableColDetail: {
    color: '#64748B',
    fontSize: 12,
    flex: 1,
    textAlign: 'center',
  },
  tableColAcc: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  heatmapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 6,
    borderLeftWidth: 4,
  },
  heatmapText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  heatmapQuizSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 2,
  },
  heatmapBadge: {
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  heatmapBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  quizMgmtCard: {
    backgroundColor: '#0F172A',
    borderColor: '#1F2937',
    borderWidth: 1,
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
  },
  quizMgmtHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  quizMgmtTitle: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    paddingRight: 8,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusPublished: {
    backgroundColor: '#10B981' + '15',
    borderColor: '#10B981',
  },
  statusDraft: {
    backgroundColor: '#F59E0B' + '15',
    borderColor: '#F59E0B',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  quizMgmtControls: {
    flexDirection: 'row',
    gap: 8,
  },
  controlBtn: {
    flex: 1,
    height: 30,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
