import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  SafeAreaView, 
  Platform
} from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { api } from '../services/api';

export default function StudyPlannerScreen({ navigation }) {
  const [studyPlan, setStudyPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [practiceLoadingDay, setPracticeLoadingDay] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);

  // Checked tasks local state cache: { "day_index-task_index": true/false }
  const [checkedTasks, setCheckedTasks] = useState({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch dashboard metrics to extract student courses
      const dashboard = await api.getStudentDashboard();
      if (dashboard.courses && dashboard.courses.length > 0) {
        setCourses(dashboard.courses);
        setSelectedCourseId(dashboard.courses[0]._id);
      }

      // Fetch AI study plan from Claude service
      const plan = await api.getStudentStudyPlan();
      setStudyPlan(plan);
    } catch (err) {
      console.error('Failed to load study plan data:', err);
      Alert.alert('Error', 'Failed to retrieve your personalized AI study plan.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (dayIdx, taskIdx) => {
    const key = `${dayIdx}-${taskIdx}`;
    setCheckedTasks(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handleStartPracticeQuiz = async (topic, dayNum) => {
    if (!selectedCourseId) {
      Alert.alert('No Course Selected', 'Please enroll in a course to take practice quizzes.');
      return;
    }

    setPracticeLoadingDay(dayNum);
    try {
      const practiceQuiz = await api.generatePracticeQuiz(topic, selectedCourseId);
      Alert.alert('Practice Quiz Ready', `AI has created a 5-question practice quiz on "${topic}"!`, [
        { 
          text: 'Start Practice Now ↗', 
          onPress: () => navigation.navigate('Quiz', { quizId: practiceQuiz._id })
        },
        { text: 'Cancel', style: 'cancel' }
      ]);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to generate practice quiz: ' + err.message);
    } finally {
      setPracticeLoadingDay(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Claude AI is generating study schedule...</Text>
      </View>
    );
  }

  const days = studyPlan?.days || [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Study Planner</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Intro Card */}
        <View style={styles.introCard}>
          <Text style={styles.introEmoji}>✨</Text>
          <View style={styles.introTextContainer}>
            <Text style={styles.introTitle}>Personalized 7-Day Plan</Text>
            <Text style={styles.introDesc}>
              Claude analyzed your recent quiz attempts and generated this custom study schedule targeting your weakest subjects.
            </Text>
          </View>
        </View>

        {/* Timeline List */}
        {days.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No study plan found. Try completing some quizzes first!</Text>
          </View>
        ) : (
          days.map((day, dayIdx) => (
            <Animated.View 
              entering={FadeInUp.delay(dayIdx * 100)} 
              key={day.day} 
              style={styles.dayCard}
            >
              {/* Day Badge & Time */}
              <View style={styles.dayHeaderRow}>
                <View style={styles.dayBadge}>
                  <Text style={styles.dayBadgeText}>DAY {day.day}</Text>
                </View>
                <Text style={styles.estMinutes}>⏱️ {day.estimatedMinutes} mins</Text>
              </View>

              {/* Topic */}
              <Text style={styles.topicText}>{day.topic}</Text>

              {/* Tasks Checklist */}
              <View style={styles.tasksContainer}>
                {day.tasks.map((task, taskIdx) => {
                  const isChecked = !!checkedTasks[`${dayIdx}-${taskIdx}`];
                  return (
                    <TouchableOpacity 
                      key={taskIdx}
                      activeOpacity={0.8}
                      style={styles.taskRow}
                      onPress={() => toggleTask(dayIdx, taskIdx)}
                    >
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={[styles.taskText, isChecked && styles.taskTextChecked]}>
                        {task}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Action Button */}
              <TouchableOpacity 
                activeOpacity={0.8}
                style={styles.practiceBtn}
                onPress={() => handleStartPracticeQuiz(day.recommendedQuizTopic || day.topic, day.day)}
                disabled={practiceLoadingDay === day.day}
              >
                {practiceLoadingDay === day.day ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.practiceBtnText}>Practice: {day.recommendedQuizTopic || day.topic}</Text>
                    <Text style={styles.practiceBtnIcon}>⚡</Text>
                  </>
                )}
              </TouchableOpacity>
            </Animated.View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    paddingTop: Platform.OS === 'android' ? 36 : 0,
  },
  center: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1E',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#161618',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262629',
  },
  backBtnText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  introCard: {
    flexDirection: 'row',
    backgroundColor: '#EEF2F6',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderColor: '#E2E8F0',
    borderWidth: 1,
    gap: 12,
  },
  introEmoji: {
    fontSize: 24,
  },
  introTextContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  introTitle: {
    color: '#1E1B4B',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  introDesc: {
    color: '#312E81',
    fontSize: 12,
    lineHeight: 16,
  },
  dayCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    backgroundColor: '#3B82F6' + '20',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  dayBadgeText: {
    color: '#3B82F6',
    fontSize: 10,
    fontWeight: '800',
  },
  estMinutes: {
    color: '#71717A',
    fontSize: 11.5,
    fontWeight: '600',
  },
  topicText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 12,
  },
  tasksContainer: {
    gap: 10,
    marginBottom: 16,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C0C0E',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E1E22',
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#52525B',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  checkboxChecked: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  taskText: {
    color: '#D4D4D8',
    fontSize: 12.5,
    flex: 1,
    lineHeight: 16,
  },
  taskTextChecked: {
    color: '#71717A',
    textDecorationLine: 'line-through',
  },
  practiceBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 10,
    height: 40,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  practiceBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  practiceBtnIcon: {
    color: '#FFFFFF',
    fontSize: 11,
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: '#71717A',
    fontSize: 13.5,
    textAlign: 'center',
  },
});
