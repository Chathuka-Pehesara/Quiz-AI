import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TextInput, 
  TouchableOpacity, 
  Alert, 
  ActivityIndicator, 
  Modal, 
  Platform,
  Dimensions
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { VictoryLine, VictoryBar, VictoryChart, VictoryTheme, VictoryAxis, VictoryGroup, VictoryArea } from 'victory-native';
import { api } from '../services/api';
import { clearAuth, getRoleFromToken } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';

export default function AdminDashboard({ navigation }) {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = getStyles(colors, theme);
  const isFocused = useIsFocused();
  const [isLargeScreen, setIsLargeScreen] = useState(Dimensions.get('window').width > 768);
  const [activeTab, setActiveTab] = useState('overview'); // overview, flags, quizzes, users, courses, ai, settings
  const [unreviewedCount, setUnreviewedCount] = useState(0);
  const [cheatFlags, setCheatFlags] = useState([]);

  useEffect(() => {
    const checkRole = async () => {
      const role = await getRoleFromToken();
      if (role !== 'admin') {
        Alert.alert('Access Denied', 'You do not have permission to access the Admin Console.');
        if (role === 'professor') {
          navigation.replace('ProfessorDashboard');
        } else {
          navigation.replace('StudentDashboard');
        }
      }
    };
    checkRole();
  }, []);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setIsLargeScreen(window.width > 768);
    });
    return () => {
      if (subscription && subscription.remove) {
        subscription.remove();
      }
    };
  }, []);
  
  // Data States
  const [overviewData, setOverviewData] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [settings, setSettings] = useState(null);
  
  // Input/Action States
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userFlaggedFilter, setUserFlaggedFilter] = useState(false);

  // Forms States
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'student' });
  const [newCourse, setNewCourse] = useState({ code: '', name: '', professorEmail: '' });
  const [aiGenerator, setAiGenerator] = useState({ title: '', courseId: '', notes: '', numQuestions: '5' });

  // Modals States
  const [reviewUserModal, setReviewUserModal] = useState(null); // holds user object to review
  const [editUserModal, setEditUserModal] = useState(null); // holds user object to edit
  const [addUserModalVisible, setAddUserModalVisible] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, activeTab, userSearch, userRoleFilter, userFlaggedFilter]);

  const loadData = async () => {
    try {
      // Fetch unreviewed flags count for the sidebar badge
      try {
        const countRes = await api.getAdminCheatFlagsUnreadCount();
        setUnreviewedCount(countRes.count);
      } catch (err) {
        console.warn('Failed to load unread flags count:', err);
      }

      if (activeTab === 'overview') {
        const data = await api.getAdminAnalytics();
        setOverviewData(data);
      } else if (activeTab === 'flags') {
        const flags = await api.getAdminCheatFlags();
        setCheatFlags(flags);
      } else if (activeTab === 'quizzes') {
        const quizList = await api.getAdminQuizzes();
        setQuizzes(quizList);
        const courseList = await api.getAdminCourses();
        setCourses(courseList);
      } else if (activeTab === 'users') {
        const userList = await api.getAdminUsers(userSearch, userRoleFilter, userFlaggedFilter ? 'true' : '');
        setUsers(userList);
      } else if (activeTab === 'courses') {
        const courseList = await api.getAdminCourses();
        setCourses(courseList);
      } else if (activeTab === 'ai' || activeTab === 'settings') {
        const config = await api.getAdminSettings();
        setSettings(config);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await clearAuth();
    navigation.replace('Login');
  };

  // 1. Quiz Management Actions
  const handleGenerateQuiz = async () => {
    if (!aiGenerator.courseId || !aiGenerator.title || !aiGenerator.notes) {
      Alert.alert('Error', 'Please enter a title, choose a course, and paste lecture notes');
      return;
    }
    setActionLoading(true);
    try {
      const count = parseInt(aiGenerator.numQuestions) || 5;
      const quiz = await api.generateQuiz(aiGenerator.title.trim(), aiGenerator.courseId, aiGenerator.notes, count);
      Alert.alert('Success', `AI generated quiz "${quiz.title}" with ${quiz.questions.length} questions!`);
      setAiGenerator({ ...aiGenerator, title: '', notes: '' });
      loadData();
    } catch (err) {
      Alert.alert('Generation Failed', err.message || 'Error communicating with Claude API');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteQuiz = async (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to permanently delete this quiz?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAdminQuiz(id);
            loadData();
          } catch (err) {
            Alert.alert('Failed to delete', err.message);
          }
        }
      }
    ]);
  };

  // 2. User Management Actions
  const handleCreateUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setActionLoading(true);
    try {
      await api.createAdminUser(newUser);
      Alert.alert('Success', 'User created successfully!');
      setNewUser({ name: '', email: '', password: '', role: 'student' });
      setAddUserModalVisible(false);
      loadData();
    } catch (err) {
      Alert.alert('Failed to create user', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateUser = async () => {
    if (!editUserModal.name || !editUserModal.email) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }
    setActionLoading(true);
    try {
      await api.updateAdminUser(editUserModal._id, editUserModal);
      Alert.alert('Success', 'User details updated successfully!');
      setEditUserModal(null);
      loadData();
    } catch (err) {
      Alert.alert('Failed to update', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleFlag = async (user, isFlagged, flagReason = '') => {
    try {
      await api.updateAdminUser(user._id, {
        isFlagged,
        flagReason
      });
      setReviewUserModal(null);
      loadData();
    } catch (err) {
      Alert.alert('Failed to update flag', err.message);
    }
  };

  const handleDeleteUser = async (id) => {
    Alert.alert('Confirm Delete', 'Are you sure you want to delete this user account?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAdminUser(id);
            loadData();
          } catch (err) {
            Alert.alert('Failed to delete', err.message);
          }
        }
      }
    ]);
  };

  // 3. Course Actions
  const handleCreateCourse = async () => {
    if (!newCourse.code || !newCourse.name) {
      Alert.alert('Error', 'Please fill in course code and name');
      return;
    }
    setActionLoading(true);
    try {
      await api.createAdminCourse(newCourse);
      Alert.alert('Success', `Course ${newCourse.code.toUpperCase()} created successfully!`);
      setNewCourse({ code: '', name: '', professorEmail: '' });
      loadData();
    } catch (err) {
      Alert.alert('Failed to create course', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteCourse = async (id) => {
    Alert.alert('Confirm Delete', 'Delete this course? It will clean up all registries.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteAdminCourse(id);
            loadData();
          } catch (err) {
            Alert.alert('Failed to delete', err.message);
          }
        }
      }
    ]);
  };

  // 4. Settings Actions
  const handleSaveSettings = async (updates) => {
    setActionLoading(true);
    try {
      const updated = await api.updateAdminSettings(updates);
      setSettings(updated);
      Alert.alert('Success', 'Admin configurations updated successfully!');
      loadData();
    } catch (err) {
      Alert.alert('Failed to update settings', err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Render Helpers
  const renderSidebar = () => {
    const tabs = [
      { id: 'overview', icon: '📊', label: 'Overview' },
      { id: 'flags', icon: '🚨', label: 'Flags' },
      { id: 'quizzes', icon: '📝', label: 'Quizzes' },
      { id: 'users', icon: '👥', label: 'Users' },
      { id: 'courses', icon: '🎓', label: 'Courses' },
      { id: 'ai', icon: '✨', label: 'AI' }
    ];

    return (
      <View style={[styles.sidebar, { backgroundColor: colors.card, borderRightColor: colors.border }]}>
        <View style={styles.sidebarAvatar}>
          <Text style={styles.sidebarAvatarText}>AD</Text>
        </View>
        <View style={styles.sidebarNav}>
          {tabs.map((tab) => (
            <TouchableOpacity 
              key={tab.id}
              style={[styles.sidebarBtn, activeTab === tab.id && { backgroundColor: colors.background }]}
              onPress={() => {
                setLoading(true);
                setActiveTab(tab.id);
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Text style={styles.sidebarIcon}>{tab.icon}</Text>
                  {isLargeScreen && <Text style={[styles.sidebarLabel, { color: activeTab === tab.id ? colors.text : colors.textMuted }]}>{tab.label}</Text>}
                </View>
                {tab.id === 'flags' && unreviewedCount > 0 && (
                  <View style={styles.unreviewedBadgePill}>
                    <Text style={styles.unreviewedBadgeText}>{unreviewedCount}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity 
          style={[styles.sidebarBtn, activeTab === 'settings' && { backgroundColor: colors.background }]}
          onPress={() => {
            setLoading(true);
            setActiveTab('settings');
          }}
        >
          <Text style={styles.sidebarIcon}>⚙️</Text>
          {isLargeScreen && <Text style={[styles.sidebarLabel, { color: activeTab === 'settings' ? colors.text : colors.textMuted }]}>Settings</Text>}
        </TouchableOpacity>
      </View>
    );
  };

  const renderOverview = () => {
    if (!overviewData) return null;

    // Daily quiz activity chart data format
    const chartData = (overviewData.dailyActivity || []).map((item) => ({
      x: item.date,
      y: item.count
    }));

    // Top active courses chart data format
    const courseChartData = (overviewData.topCourses || []).map((item) => ({
      x: item.code,
      y: item.attempts
    }));

    // Find maximum count for charts y-domain
    const maxCourseAttempts = Math.max(...(overviewData.topCourses || []).map(i => i.attempts), 5);

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <Text style={[styles.panelTitleText, { color: colors.text }]}>University Analytics Overview</Text>
            <View style={[styles.healthBadge, { backgroundColor: colors.green + '20' }]}>
              <Text style={[styles.healthDot, { color: colors.green }]}>●</Text>
              <Text style={[styles.healthText, { color: colors.green }]}>System Active</Text>
            </View>
          </View>

          {/* Stats Summary cards */}
          <View style={styles.statsRow}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.textMuted }]}>Active Students</Text>
              <Text style={[styles.statCardVal, { color: '#C084FC' }]}>{overviewData.totalActiveStudents}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.textMuted }]}>Quizzes (This Week)</Text>
              <Text style={[styles.statCardVal, { color: '#60A5FA' }]}>{overviewData.totalQuizzesTakenThisWeek}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.statCardLabel, { color: colors.textMuted }]}>University Avg Score</Text>
              <Text style={[styles.statCardVal, { color: '#34D399' }]}>{overviewData.averageScoreAllCourses}%</Text>
            </View>
          </View>

          {/* Line Chart of Daily quiz activity */}
          <View style={[styles.analyticsChartContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.chartTitleText, { color: colors.text }]}>Daily Quiz Activity (Past 30 Days)</Text>
            {chartData.length > 0 ? (
              <View style={{ alignItems: 'center', marginLeft: -20 }}>
                <VictoryChart
                  theme={VictoryTheme.material}
                  height={200}
                  width={340}
                  padding={{ top: 20, bottom: 40, left: 45, right: 20 }}
                >
                  <VictoryAxis
                    tickCount={6}
                    style={{
                      tickLabels: { fill: colors.textMuted, fontSize: 8 },
                      axis: { stroke: colors.border },
                      grid: { stroke: 'transparent' }
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    style={{
                      tickLabels: { fill: colors.textMuted, fontSize: 8 },
                      axis: { stroke: colors.border },
                      grid: { stroke: colors.border, strokeDasharray: '4, 4' }
                    }}
                  />
                  <VictoryArea
                    data={chartData}
                    style={{ data: { fill: colors.primary + '20', stroke: colors.primary, strokeWidth: 2 } }}
                    interpolation="natural"
                  />
                </VictoryChart>
              </View>
            ) : (
              <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>No quiz completions recorded.</Text>
            )}
          </View>

          {/* Bar Chart of top courses */}
          <View style={[styles.analyticsChartContainer, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[styles.chartTitleText, { color: colors.text }]}>Top 5 Most Active Courses</Text>
            {courseChartData.length > 0 ? (
              <View style={{ alignItems: 'center', marginLeft: -20 }}>
                <VictoryChart
                  theme={VictoryTheme.material}
                  height={180}
                  width={340}
                  padding={{ top: 20, bottom: 40, left: 45, right: 20 }}
                  domain={{ y: [0, maxCourseAttempts + 1] }}
                >
                  <VictoryAxis
                    style={{
                      tickLabels: { fill: colors.textMuted, fontSize: 8, fontWeight: 'bold' },
                      axis: { stroke: colors.border },
                      grid: { stroke: 'transparent' }
                    }}
                  />
                  <VictoryAxis
                    dependentAxis
                    style={{
                      tickLabels: { fill: colors.textMuted, fontSize: 8 },
                      axis: { stroke: colors.border },
                      grid: { stroke: colors.border, strokeDasharray: '4, 4' }
                    }}
                  />
                  <VictoryBar
                    data={courseChartData}
                    style={{ data: { fill: '#8B5CF6' } }}
                    barWidth={18}
                    cornerRadius={{ top: 4 }}
                  />
                </VictoryChart>
              </View>
            ) : (
              <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>No course activity data available.</Text>
            )}
          </View>

          {/* Top struggled topics */}
          <View style={[styles.analyticsChartContainer, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 16 }]}>
            <Text style={[styles.chartTitleText, { color: colors.text }]}>Top 5 Most Struggled Topics (Low Accuracy)</Text>
            {overviewData.topStruggledTopics && overviewData.topStruggledTopics.length > 0 ? (
              <View style={{ marginTop: 8 }}>
                {overviewData.topStruggledTopics.map((topic, idx) => (
                  <View key={idx} style={styles.struggledTopicRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.struggledTopicName, { color: colors.text }]}>{topic.topic}</Text>
                      <Text style={[styles.struggledTopicDetail, { color: colors.textMuted }]}>{topic.total} attempts logged</Text>
                    </View>
                    <View style={[styles.struggledTopicBadge, { backgroundColor: colors.coral + '15', borderColor: colors.coral }]}>
                      <Text style={styles.struggledTopicBadgeText}>{topic.accuracy}% accuracy</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>Not enough student quiz scores to evaluate struggled topics.</Text>
            )}
          </View>

        </View>
      </ScrollView>
    );
  };

  const renderFlags = () => {
    const handleResolveFlag = async (flagId, status) => {
      try {
        await api.updateCheatFlagStatus(flagId, status);
        Alert.alert('Success', `Flag resolved and marked as ${status}`);
        loadData();
      } catch (err) {
        Alert.alert('Error', err.message || 'Failed to update flag');
      }
    };

    return (
      <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
        <View style={styles.panel}>
          <Text style={[styles.panelTitleText, { color: colors.text }]}>Anti-Cheat Integrity Reports 🚨</Text>
          <Text style={[styles.panelSubText, { color: colors.textMuted, marginBottom: 16 }]}>
            Monitor and resolve automated system flags triggered by rapid responses, focus switches, and Claude AI integrity evaluations.
          </Text>

          {cheatFlags.length === 0 ? (
            <Text style={[styles.emptyChartText, { color: colors.textMuted }]}>No cheating behavior has been flagged on this campus!</Text>
          ) : (
            cheatFlags.map((flag) => (
              <View 
                key={flag._id} 
                style={[
                  styles.flagCard, 
                  { 
                    backgroundColor: colors.card,
                    borderColor: flag.status === 'unreviewed' ? colors.coral : flag.status === 'escalated' ? colors.amber : colors.border
                  }
                ]}
              >
                <View style={styles.flagCardHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={[styles.flagStudentName, { color: colors.text }]}>{flag.student?.name || 'Student'}</Text>
                    <Text style={[styles.flagStudentEmail, { color: colors.textMuted }]}>{flag.student?.email}</Text>
                  </View>
                  <View 
                    style={[
                      styles.flagStatusBadge, 
                      { 
                        backgroundColor: flag.status === 'unreviewed' ? colors.coral + '15' : flag.status === 'escalated' ? colors.amber + '15' : colors.teal + '15',
                        borderColor: flag.status === 'unreviewed' ? colors.coral : flag.status === 'escalated' ? colors.amber : colors.teal
                      }
                    ]}
                  >
                    <Text 
                      style={[
                        styles.flagStatusText, 
                        { color: flag.status === 'unreviewed' ? colors.coral : flag.status === 'escalated' ? colors.amber : colors.teal }
                      ]}
                    >
                      {flag.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.flagDetailsGrid}>
                  <Text style={[styles.flagDetailText, { color: colors.textMuted }]}>
                    Course: <Text style={{ color: colors.text, fontWeight: '700' }}>{flag.course?.code} — {flag.course?.name}</Text>
                  </Text>
                  <Text style={[styles.flagDetailText, { color: colors.textMuted }]}>
                    Quiz: <Text style={{ color: colors.text, fontWeight: '700' }}>{flag.quiz?.title}</Text>
                  </Text>
                  <Text style={[styles.flagDetailText, { color: colors.textMuted }]}>
                    Triggered At: <Text style={{ color: colors.text }}>{new Date(flag.timestamp).toLocaleString()}</Text>
                  </Text>
                </View>

                <View style={[styles.flagReasonCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                  <Text style={[styles.flagReasonHeader, { color: colors.amber }]}>Integrity Violation Details:</Text>
                  <Text style={[styles.flagReasonBody, { color: colors.text }]}>{flag.flagReason}</Text>
                </View>

                {flag.status === 'unreviewed' && (
                  <View style={styles.flagCardActions}>
                    <TouchableOpacity 
                      style={[styles.flagBtnAction, { backgroundColor: colors.teal }]}
                      onPress={() => handleResolveFlag(flag._id, 'reviewed')}
                    >
                      <Text style={styles.flagBtnActionText}>Resolve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.flagBtnAction, { backgroundColor: colors.amber }]}
                      onPress={() => handleResolveFlag(flag._id, 'escalated')}
                    >
                      <Text style={styles.flagBtnActionText}>Escalate</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderQuizzes = () => {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitleText}>Quiz management</Text>
        
        {/* AI Generator Panel */}
        <View style={styles.subCard}>
          <Text style={styles.subCardTitle}>⚡ Claude AI Exam Generator</Text>
          <Text style={styles.subCardSub}>Auto-compose deep adaptive question banks based on syllabus text inputs.</Text>
          
          <View style={[styles.formRow, { flexDirection: isLargeScreen ? 'row' : 'column', marginBottom: isLargeScreen ? 12 : 0 }]}>
            <TextInput
              style={[styles.input, { flex: 1, width: isLargeScreen ? 'auto' : '100%', marginBottom: isLargeScreen ? 0 : 12 }]}
              placeholder="Quiz Title (e.g. Chapter 4: Database Normalization)"
              placeholderTextColor="#71717A"
              value={aiGenerator.title}
              onChangeText={(txt) => setAiGenerator({ ...aiGenerator, title: txt })}
            />
            
            <View style={[styles.pickerContainer, { width: isLargeScreen ? 180 : '100%', marginBottom: 12 }]}>
              <TextInput
                style={styles.pickerFakeInput}
                placeholder="Course (ID/Code)"
                placeholderTextColor="#71717A"
                value={aiGenerator.courseId}
                onChangeText={(txt) => setAiGenerator({ ...aiGenerator, courseId: txt })}
              />
            </View>
          </View>

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Paste syllabus material, notes, or transcripts..."
            placeholderTextColor="#71717A"
            multiline
            numberOfLines={4}
            value={aiGenerator.notes}
            onChangeText={(txt) => setAiGenerator({ ...aiGenerator, notes: txt })}
          />

          <View style={[styles.formRow, { flexDirection: isLargeScreen ? 'row' : 'column', alignItems: isLargeScreen ? 'center' : 'stretch', gap: 12 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: isLargeScreen ? 0 : 12 }}>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>Questions count:</Text>
              <TextInput
                style={[styles.input, { width: 50, textAlign: 'center', marginBottom: 0 }]}
                keyboardType="numeric"
                maxLength={2}
                value={aiGenerator.numQuestions}
                onChangeText={(txt) => setAiGenerator({ ...aiGenerator, numQuestions: txt })}
              />
            </View>

            <TouchableOpacity 
              style={[styles.generateBtn, { flex: isLargeScreen ? 0 : 1 }]}
              onPress={handleGenerateQuiz}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.generateBtnText}>Generate with Claude</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Quizzes Table */}
        <Text style={styles.sectionTitleText}>Question banks</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={[styles.table, { minWidth: isLargeScreen ? '100%' : 780 }]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { width: 220 }]}>Title</Text>
              <Text style={[styles.th, { width: 100 }]}>Course</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Questions</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Attempts</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Avg Score</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Status</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Actions</Text>
            </View>

            {quizzes.length === 0 ? (
              <Text style={styles.tableEmptyText}>No quizzes found.</Text>
            ) : (
              quizzes.map((quiz) => (
                <View key={quiz._id} style={styles.tableRow}>
                  <Text style={[styles.td, { width: 220, color: colors.text, fontWeight: 'bold' }]} numberOfLines={1}>
                    {quiz.title}
                  </Text>
                  <Text style={[styles.td, { width: 100, color: colors.textMuted }]}>
                    {quiz.courseCode}
                  </Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'center', color: colors.textMuted }]}>
                    {quiz.questionCount}
                  </Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'center', color: colors.textMuted }]}>
                    {quiz.attemptsCount}
                  </Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'center', color: colors.teal, fontWeight: 'bold' }]}>
                    {quiz.averageScore}%
                  </Text>
                  <View style={[styles.td, { width: 100, alignItems: 'center' }]}>
                    <View style={[styles.statusBadge, quiz.isPublished ? styles.badgeGreen : styles.badgeGrey]}>
                      <Text style={[styles.statusBadgeText, quiz.isPublished ? styles.textGreen : styles.textGrey]}>
                        {quiz.isPublished ? 'Published' : 'Draft'}
                      </Text>
                    </View>
                  </View>
                  <View style={[styles.td, { width: 100, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}>
                    <TouchableOpacity 
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeleteQuiz(quiz._id)}
                    >
                      <Text style={styles.actionBtnTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderUsers = () => {
    return (
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitleText}>User management</Text>
          <TouchableOpacity 
            style={styles.addUserBtn}
            onPress={() => setAddUserModalVisible(true)}
          >
            <Text style={styles.addUserBtnText}>+ Create User</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Section */}
        <View style={[styles.filtersRow, { flexDirection: isLargeScreen ? 'row' : 'column', alignItems: 'stretch', gap: 12 }]}>
          <TextInput
            style={[styles.input, { flex: isLargeScreen ? 2 : 0, width: isLargeScreen ? 'auto' : '100%', marginBottom: isLargeScreen ? 0 : 12 }]}
            placeholder="Search name or email..."
            placeholderTextColor="#71717A"
            value={userSearch}
            onChangeText={setUserSearch}
          />
          <View style={[styles.filterGroup, { width: isLargeScreen ? 'auto' : '100%', justifyContent: 'space-around', marginBottom: isLargeScreen ? 0 : 12 }]}>
            <TouchableOpacity 
              style={[styles.filterBtn, userRoleFilter === '' && styles.filterBtnActive]}
              onPress={() => setUserRoleFilter('')}
            >
              <Text style={[styles.filterBtnText, userRoleFilter === '' && styles.filterBtnTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, userRoleFilter === 'student' && styles.filterBtnActive]}
              onPress={() => setUserRoleFilter('student')}
            >
              <Text style={[styles.filterBtnText, userRoleFilter === 'student' && styles.filterBtnTextActive]}>Student</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterBtn, userRoleFilter === 'professor' && styles.filterBtnActive]}
              onPress={() => setUserRoleFilter('professor')}
            >
              <Text style={[styles.filterBtnText, userRoleFilter === 'professor' && styles.filterBtnTextActive]}>Professor</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={[styles.checkboxContainer, { width: isLargeScreen ? 'auto' : '100%', justifyContent: 'center' }, userFlaggedFilter && styles.checkboxActive]}
            onPress={() => setUserFlaggedFilter(!userFlaggedFilter)}
          >
            <Text style={styles.checkboxLabel}>🚨 Flagged Only</Text>
          </TouchableOpacity>
        </View>

        {/* Users Table */}
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={[styles.table, { minWidth: isLargeScreen ? '100%' : 720 }]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { width: 180 }]}>Name</Text>
              <Text style={[styles.th, { width: 200 }]}>Email</Text>
              <Text style={[styles.th, { width: 100, textAlign: 'center' }]}>Role</Text>
              <Text style={[styles.th, { width: 120, textAlign: 'center' }]}>Alerts</Text>
              <Text style={[styles.th, { width: 120, textAlign: 'center' }]}>Actions</Text>
            </View>

            {users.length === 0 ? (
              <Text style={styles.tableEmptyText}>No user accounts found.</Text>
            ) : (
              users.map((item) => (
                <View key={item._id} style={styles.tableRow}>
                  <Text style={[styles.td, { width: 180, color: colors.text, fontWeight: 'bold' }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={[styles.td, { width: 200, color: colors.textMuted }]} numberOfLines={1}>
                    {item.email}
                  </Text>
                  <Text style={[styles.td, { width: 100, textAlign: 'center', color: colors.textMuted, textTransform: 'capitalize' }]}>
                    {item.role}
                  </Text>
                  
                  <View style={[styles.td, { width: 120, alignItems: 'center' }]}>
                    {item.isFlagged ? (
                      <View style={[styles.statusBadge, styles.badgeRed, { flexDirection: 'row', gap: 4 }]}>
                        <Text style={[styles.statusBadgeText, styles.textRed]}>🚨 Flagged</Text>
                        <TouchableOpacity 
                          style={styles.reviewPillBtn}
                          onPress={() => setReviewUserModal(item)}
                        >
                          <Text style={styles.reviewPillText}>Review</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 12 }}>None</Text>
                    )}
                  </View>

                  <View style={[styles.td, { width: 120, flexDirection: 'row', gap: 6, justifyContent: 'center' }]}>
                    <TouchableOpacity 
                      style={styles.actionBtnEdit}
                      onPress={() => setEditUserModal(item)}
                    >
                      <Text style={styles.actionBtnTextEdit}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeleteUser(item._id)}
                    >
                      <Text style={styles.actionBtnTextDelete}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderCourses = () => {
    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitleText}>Course management</Text>

        {/* Create Course Panel */}
        <View style={styles.subCard}>
          <Text style={styles.subCardTitle}>🎓 Add New Course Registry</Text>
          <View style={[styles.formRow, { flexDirection: isLargeScreen ? 'row' : 'column', marginBottom: isLargeScreen ? 12 : 0 }]}>
            <TextInput
              style={[styles.input, { width: isLargeScreen ? 120 : '100%', marginBottom: isLargeScreen ? 0 : 12 }]}
              placeholder="Code (e.g. CS302)"
              placeholderTextColor="#71717A"
              autoCapitalize="characters"
              value={newCourse.code}
              onChangeText={(txt) => setNewCourse({ ...newCourse, code: txt })}
            />
            <TextInput
              style={[styles.input, { flex: isLargeScreen ? 2 : 1, width: isLargeScreen ? 'auto' : '100%', marginBottom: isLargeScreen ? 0 : 12 }]}
              placeholder="Course Name (e.g. Database Systems)"
              placeholderTextColor="#71717A"
              value={newCourse.name}
              onChangeText={(txt) => setNewCourse({ ...newCourse, name: txt })}
            />
          </View>
          <View style={[styles.formRow, { flexDirection: isLargeScreen ? 'row' : 'column', gap: 12 }]}>
            <TextInput
              style={[styles.input, { flex: isLargeScreen ? 1 : 1, width: isLargeScreen ? 'auto' : '100%', marginBottom: isLargeScreen ? 0 : 12 }]}
              placeholder="Assigned Professor Email"
              placeholderTextColor="#71717A"
              value={newCourse.professorEmail}
              onChangeText={(txt) => setNewCourse({ ...newCourse, professorEmail: txt })}
            />
            <TouchableOpacity 
              style={[styles.createBtn, { height: 38 }]}
              onPress={handleCreateCourse}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.createBtnText}>Create Course</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Courses Table */}
        <Text style={styles.sectionTitleText}>Registered courses</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={[styles.table, { minWidth: isLargeScreen ? '100%' : 840 }]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, { width: 100 }]}>Code</Text>
              <Text style={[styles.th, { width: 180 }]}>Name</Text>
              <Text style={[styles.th, { width: 140 }]}>Professor</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Students</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Quizzes</Text>
              <Text style={[styles.th, { width: 160 }]}>Battle History</Text>
              <Text style={[styles.th, { width: 80, textAlign: 'center' }]}>Actions</Text>
            </View>

            {courses.length === 0 ? (
              <Text style={styles.tableEmptyText}>No course registries found.</Text>
            ) : (
              courses.map((course) => (
                <View key={course._id} style={styles.tableRow}>
                  <Text style={[styles.td, { width: 100, color: colors.text, fontWeight: 'bold' }]}>
                    {course.code}
                  </Text>
                  <Text style={[styles.td, { width: 180, color: colors.text }]} numberOfLines={1}>
                    {course.name}
                  </Text>
                  <Text style={[styles.td, { width: 140, color: colors.textMuted }]} numberOfLines={1}>
                    {course.professorName}
                  </Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'center', color: colors.textMuted }]}>
                    {course.studentsCount}
                  </Text>
                  <Text style={[styles.td, { width: 80, textAlign: 'center', color: colors.textMuted }]}>
                    {course.quizCount}
                  </Text>
                  <View style={[styles.td, { width: 160 }]}>
                    {course.battleHistory?.map((b, idx) => (
                      <Text key={idx} style={{ color: colors.textMuted, fontSize: 11 }}>
                        {b.code} ({b.date}): {b.players} pl
                      </Text>
                    ))}
                  </View>
                  <View style={[styles.td, { width: 80, alignItems: 'center' }]}>
                    <TouchableOpacity 
                      style={styles.actionBtnDelete}
                      onPress={() => handleDeleteCourse(course._id)}
                    >
                      <Text style={styles.actionBtnTextDelete}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderAiSettings = () => {
    if (!settings) return null;

    const isApiKeyOk = settings.claudeApiKeyConfigured;

    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitleText}>AI settings</Text>

        <View style={styles.settingGroupCard}>
          <Text style={styles.settingGroupTitle}>Claude API Connection Status</Text>
          <View style={styles.statusRowBadge}>
            <View style={[styles.statusBadge, isApiKeyOk ? styles.badgeGreen : styles.badgeYellow]}>
              <Text style={[styles.statusBadgeText, isApiKeyOk ? styles.textGreen : styles.textYellow]}>
                {isApiKeyOk ? '● Connected (Claude 3.5 Sonnet)' : '● Unconfigured (Local Simulation fallback active)'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.settingGroupCard}>
          <Text style={styles.settingGroupTitle}>AI Quiz Generation Parameters</Text>
          <Text style={styles.settingGroupSub}>Adjust number of questions and question formats generated by Claude.</Text>
          
          <View style={styles.formFieldRow}>
            <Text style={styles.formFieldLabel}>Questions to generate per upload:</Text>
            <TextInput
              style={[styles.input, { width: 60, marginBottom: 0, textAlign: 'center' }]}
              keyboardType="numeric"
              value={String(settings.questionsPerUpload)}
              onChangeText={(txt) => setSettings({ ...settings, questionsPerUpload: parseInt(txt) || 5 })}
            />
          </View>

          <Text style={styles.formFieldSubLabel}>Include Question Formats:</Text>
          <View style={styles.checkboxGroup}>
            {['mcq', 'tf', 'short'].map((type) => {
              const checked = settings.questionTypes.includes(type);
              return (
                <TouchableOpacity 
                  key={type}
                  style={[styles.filterBtn, checked && styles.filterBtnActive]}
                  onPress={() => {
                    let nextTypes = [...settings.questionTypes];
                    if (checked) {
                      nextTypes = nextTypes.filter(t => t !== type);
                    } else {
                      nextTypes.push(type);
                    }
                    setSettings({ ...settings, questionTypes: nextTypes });
                  }}
                >
                  <Text style={[styles.filterBtnText, checked && styles.filterBtnTextActive]}>
                    {type.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.settingGroupCard}>
          <Text style={styles.settingGroupTitle}>AI Anti-Cheat Alert Sensitivity</Text>
          <Text style={styles.settingGroupSub}>Adjust the thresholds for flagging rapid answers and background focus alerts.</Text>
          
          <View style={styles.sliderRow}>
            <Text style={styles.sliderLabel}>Alert Sensitivity: {settings.antiCheatSensitivity}%</Text>
            
            {/* Custom slider replacement buttons */}
            <View style={styles.sliderMockContainer}>
              <TouchableOpacity 
                style={styles.sliderMockBtn}
                onPress={() => setSettings({ ...settings, antiCheatSensitivity: Math.max(0, settings.antiCheatSensitivity - 10) })}
              >
                <Text style={styles.sliderMockBtnText}>-</Text>
              </TouchableOpacity>
              <View style={styles.sliderMockTrackBg}>
                <View style={[styles.sliderMockTrackFill, { width: `${settings.antiCheatSensitivity}%` }]} />
              </View>
              <TouchableOpacity 
                style={styles.sliderMockBtn}
                onPress={() => setSettings({ ...settings, antiCheatSensitivity: Math.min(100, settings.antiCheatSensitivity + 10) })}
              >
                <Text style={styles.sliderMockBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveSettingsBtn}
          onPress={() => handleSaveSettings(settings)}
        >
          <Text style={styles.saveSettingsText}>Apply AI Parameters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderSettings = () => {
    if (!settings) return null;

    const toggle = (field) => {
      setSettings({
        ...settings,
        toggles: {
          ...settings.toggles,
          [field]: !settings.toggles[field]
        }
      });
    };

    return (
      <View style={styles.panel}>
        <Text style={styles.panelTitleText}>Settings</Text>

        <View style={styles.settingGroupCard}>
          <Text style={styles.settingGroupTitle}>University Profile</Text>
          
          <View style={styles.formRowContainer}>
            <Text style={styles.inputFieldLabel}>University Name</Text>
            <TextInput
              style={styles.input}
              value={settings.universityName}
              onChangeText={(txt) => setSettings({ ...settings, universityName: txt })}
            />
          </View>

          <View style={styles.formRowContainer}>
            <Text style={styles.inputFieldLabel}>Administrator Email Address</Text>
            <TextInput
              style={styles.input}
              keyboardType="email-address"
              value={settings.adminEmail}
              onChangeText={(txt) => setSettings({ ...settings, adminEmail: txt })}
            />
          </View>
        </View>

        <View style={styles.settingGroupCard}>
          <Text style={styles.settingGroupTitle}>Feature Toggles</Text>
          <Text style={styles.settingGroupSub}>Turn on/off specific modules on the platform.</Text>
          
          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Dark Theme mode</Text>
              <Text style={styles.toggleSub}>Toggle between Dark and Light mode themes</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, theme === 'dark' ? styles.switchOn : styles.switchOff]}
              onPress={toggleTheme}
            >
              <View style={[styles.switchKnob, theme === 'dark' ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Live Quiz Battles</Text>
              <Text style={styles.toggleSub}>Synchronous classroom multiplayer games</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.liveBattles ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('liveBattles')}
            >
              <View style={[styles.switchKnob, settings.toggles.liveBattles ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Antigravity Physics Micro-game</Text>
              <Text style={styles.toggleSub}>Spring-physics item throwing celebrations</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.antigravity ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('antigravity')}
            >
              <View style={[styles.switchKnob, settings.toggles.antigravity ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Voice Quiz Mode</Text>
              <Text style={styles.toggleSub}>Text-to-speech oral exams capabilities</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.voiceQuiz ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('voiceQuiz')}
            >
              <View style={[styles.switchKnob, settings.toggles.voiceQuiz ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

           <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Peer Quiz Generation</Text>
              <Text style={styles.toggleSub}>Permit students to author challenges for classmates</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.peerQuiz ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('peerQuiz')}
            >
              <View style={[styles.switchKnob, settings.toggles.peerQuiz ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Biometric Authentication</Text>
              <Text style={styles.toggleSub}>TouchID / FaceID login capability for students</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.biometricLogin ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('biometricLogin')}
            >
              <View style={[styles.switchKnob, settings.toggles.biometricLogin ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>

          <View style={styles.toggleRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.toggleTitle}>Push Notifications</Text>
              <Text style={styles.toggleSub}>Daily reminders and study streak alert triggers</Text>
            </View>
            <TouchableOpacity 
              style={[styles.switch, settings.toggles.pushNotifications ? styles.switchOn : styles.switchOff]}
              onPress={() => toggle('pushNotifications')}
            >
              <View style={[styles.switchKnob, settings.toggles.pushNotifications ? styles.switchKnobOn : styles.switchKnobOff]} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.saveSettingsBtn}
          onPress={() => handleSaveSettings(settings)}
        >
          <Text style={styles.saveSettingsText}>Save System Config</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderMobileTabBar = () => {
    const tabs = [
      { id: 'overview', icon: '📊', label: 'Overview' },
      { id: 'flags', icon: '🚨', label: 'Flags' },
      { id: 'quizzes', icon: '📝', label: 'Quizzes' },
      { id: 'users', icon: '👥', label: 'Users' },
      { id: 'courses', icon: '🎓', label: 'Courses' },
      { id: 'ai', icon: '✨', label: 'AI' },
      { id: 'settings', icon: '⚙️', label: 'Settings' }
    ];

    return (
      <View style={styles.mobileTabBar}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          contentContainerStyle={styles.mobileTabBarScrollContainer}
        >
          {tabs.map((tab) => (
            <TouchableOpacity 
              key={tab.id}
              style={[styles.mobileTabBtn, activeTab === tab.id && styles.mobileTabBtnActive]}
              onPress={() => {
                setLoading(true);
                setActiveTab(tab.id);
              }}
            >
              <Text style={styles.mobileTabIcon}>{tab.icon}</Text>
              <Text style={[styles.mobileTabLabel, activeTab === tab.id && styles.mobileTabLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  if (loading && !overviewData && activeTab === 'overview') {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { flexDirection: isLargeScreen ? 'row' : 'column', backgroundColor: colors.background }]}>
      {/* Mobile Top Header */}
      {!isLargeScreen && (
        <View style={[styles.mobileHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <View style={styles.mobileHeaderLeft}>
            <View style={[styles.sidebarAvatar, { marginBottom: 0 }]}>
              <Text style={styles.sidebarAvatarText}>AD</Text>
            </View>
            <Text style={[styles.mobileHeaderTitle, { color: colors.text }]}>Admin Console</Text>
          </View>
          <TouchableOpacity style={[styles.mobileLogoutBtn, { backgroundColor: colors.background, borderColor: colors.border }]} onPress={handleLogout}>
            <Text style={[styles.mobileLogoutText, { color: colors.text }]}>Logout</Text>
          </TouchableOpacity>
        </View>
      )}

      {isLargeScreen && renderSidebar()}
      
      <ScrollView 
        style={[styles.mainPanel, { backgroundColor: colors.background }]} 
        contentContainerStyle={[
          styles.mainContent, 
          { 
            padding: isLargeScreen ? 24 : 12,
            paddingBottom: isLargeScreen ? 40 : 100 
          }
        ]}
      >
        {loading ? (
          <View style={styles.tabLoader}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'overview' && renderOverview()}
            {activeTab === 'flags' && renderFlags()}
            {activeTab === 'quizzes' && renderQuizzes()}
            {activeTab === 'users' && renderUsers()}
            {activeTab === 'courses' && renderCourses()}
            {activeTab === 'ai' && renderAiSettings()}
            {activeTab === 'settings' && renderSettings()}
          </>
        )}
      </ScrollView>

      {/* Mobile Bottom Tab Bar */}
      {!isLargeScreen && renderMobileTabBar()}

      {/* Review Flagged User Modal */}
      {reviewUserModal && (
        <Modal
          animationType="fade"
          transparent={true}
          visible={!!reviewUserModal}
          onRequestClose={() => setReviewUserModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { width: '90%', maxWidth: 340 }]}>
              <Text style={styles.modalEmoji}>🚨</Text>
              <Text style={styles.modalTitle}>Anti-Cheat Flag Review</Text>
              
              <View style={styles.modalDetailsBox}>
                <Text style={styles.modalFieldLabel}>Name</Text>
                <Text style={styles.modalFieldValue}>{reviewUserModal.name}</Text>
                
                <Text style={styles.modalFieldLabel}>Email</Text>
                <Text style={styles.modalFieldValue}>{reviewUserModal.email || 'student@university.edu'}</Text>
                
                <Text style={styles.modalFieldLabel}>Alert Triggered</Text>
                <Text style={[styles.modalFieldValue, { color: colors.coral, fontWeight: 'bold' }]}>
                  {reviewUserModal.flagReason || 'Rapid answers (suspected scripting)'}
                </Text>
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.teal }]}
                  onPress={() => handleToggleFlag(reviewUserModal, false)}
                >
                  <Text style={styles.modalBtnText}>Dismiss & Clear Flag</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={() => setReviewUserModal(null)}
                >
                  <Text style={styles.modalBtnText}>Keep Flagged</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit User Modal */}
      {editUserModal && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!editUserModal}
          onRequestClose={() => setEditUserModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { width: '90%', maxWidth: 340 }]}>
              <Text style={styles.modalTitle}>Edit User Profile</Text>

              <TextInput
                style={styles.input}
                placeholder="Name"
                placeholderTextColor="#71717A"
                value={editUserModal.name}
                onChangeText={(txt) => setEditUserModal({ ...editUserModal, name: txt })}
              />

              <TextInput
                style={styles.input}
                placeholder="Email Address"
                placeholderTextColor="#71717A"
                keyboardType="email-address"
                value={editUserModal.email}
                onChangeText={(txt) => setEditUserModal({ ...editUserModal, email: txt })}
              />

              <View style={styles.pickerContainer}>
                <TextInput
                  style={styles.pickerFakeInput}
                  placeholder="Role (student, professor, admin)"
                  placeholderTextColor="#71717A"
                  value={editUserModal.role}
                  onChangeText={(txt) => setEditUserModal({ ...editUserModal, role: txt.toLowerCase() })}
                />
              </View>

              <View style={styles.modalActionsRow}>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: '#6366F1' }]}
                  onPress={handleUpdateUser}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.modalBtnText}>Update Account</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalBtn, { backgroundColor: colors.border }]}
                  onPress={() => setEditUserModal(null)}
                >
                  <Text style={styles.modalBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Add User Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={addUserModalVisible}
        onRequestClose={() => setAddUserModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { width: '90%', maxWidth: 340 }]}>
            <Text style={styles.modalTitle}>Create New Account</Text>

            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#71717A"
              value={newUser.name}
              onChangeText={(txt) => setNewUser({ ...newUser, name: txt })}
            />

            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#71717A"
              keyboardType="email-address"
              value={newUser.email}
              onChangeText={(txt) => setNewUser({ ...newUser, email: txt })}
            />

            <TextInput
              style={styles.input}
              placeholder="Account Password"
              placeholderTextColor="#71717A"
              secureTextEntry
              value={newUser.password}
              onChangeText={(txt) => setNewUser({ ...newUser, password: txt })}
            />

            <View style={styles.pickerContainer}>
              <TextInput
                style={styles.pickerFakeInput}
                placeholder="Role (student, professor, admin)"
                placeholderTextColor="#71717A"
                value={newUser.role}
                onChangeText={(txt) => setNewUser({ ...newUser, role: txt.toLowerCase() })}
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.teal }]}
                onPress={handleCreateUser}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalBtnText}>Create Account</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                onPress={() => setAddUserModalVisible(false)}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    height: '100%',
    overflow: 'hidden',
  },
  sidebar: {
    width: 180,
    backgroundColor: colors.card,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    alignItems: 'center',
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  sidebarAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  sidebarAvatarText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  sidebarNav: {
    flex: 1,
    width: '100%',
    paddingHorizontal: 8,
    gap: 8,
    marginTop: 20,
  },
  sidebarBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    gap: 12,
  },
  sidebarBtnActive: {
    backgroundColor: colors.border,
  },
  sidebarIcon: {
    fontSize: 18,
  },
  sidebarLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  sidebarLabelActive: {
    color: colors.white,
  },
  mainPanel: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mainContent: {
    padding: 24,
  },
  tabLoader: {
    paddingVertical: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  panel: {
    flex: 1,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  panelTitleText: {
    color: colors.white,
    fontSize: 18,
    fontWeight: '800',
  },
  healthBadge: {
    backgroundColor: '#ECFDF5',
    borderRadius: 14,
    paddingVertical: 4,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  healthDot: {
    color: colors.teal,
    fontSize: 10,
  },
  healthText: {
    color: colors.teal,
    fontSize: 11.5,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    gap: 8,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  statCardLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
  },
  statCardIcon: {
    fontSize: 16,
    marginTop: 4,
  },
  statCardVal: {
    fontSize: 22,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitleText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 12,
  },
  activityFeed: {
    gap: 10,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  activityIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityIcon: {
    fontSize: 14,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '700',
  },
  activityDetail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  activityRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  activityTime: {
    color: colors.textMuted,
    fontSize: 11.5,
  },
  reviewBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 6,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginTop: 2,
  },
  reviewBtnText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },

  // Sub card formatting
  subCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  subCardTitle: {
    color: colors.white,
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 4,
  },
  subCardSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: 14,
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    color: colors.text,
    fontSize: 13,
    marginBottom: 12,
  },
  textArea: {
    height: 80,
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  pickerFakeInput: {
    color: colors.text,
    fontSize: 13,
    padding: 0,
  },
  generateBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  generateBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // Tables
  table: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    paddingBottom: 8,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  th: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  td: {
    fontSize: 12.5,
  },
  tableEmptyText: {
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 13,
  },
  statusBadge: {
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  badgeGreen: { backgroundColor: '#ECFDF5' },
  badgeYellow: { backgroundColor: '#FFFBEB' },
  badgeGrey: { backgroundcolor: colors.text },
  badgeRed: { backgroundColor: '#FEE2E2' },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
  },
  textGreen: { color: colors.teal },
  textYellow: { color: '#B45309' },
  textGrey: { color: colors.textMuted },
  textRed: { color: '#991B1B' },
  actionBtnDelete: {
    backgroundColor: '#7F1D1D',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnTextDelete: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnEdit: {
    backgroundColor: colors.border,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionBtnTextEdit: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
  },

  // User Management tab actions
  addUserBtn: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  addUserBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  filtersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  filterGroup: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 3,
  },
  filterBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  filterBtnActive: {
    backgroundColor: colors.border,
  },
  filterBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  filterBtnTextActive: {
    color: colors.white,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  checkboxActive: {
    borderColor: colors.coral,
  },
  checkboxLabel: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  reviewPillBtn: {
    backgroundColor: colors.coral,
    borderRadius: 4,
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  reviewPillText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '900',
  },

  // Courses
  createBtn: {
    backgroundColor: colors.teal,
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  createBtnText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },

  // AI settings
  settingGroupCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  settingGroupTitle: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  settingGroupSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginBottom: 14,
  },
  statusRowBadge: {
    flexDirection: 'row',
    marginTop: 4,
  },
  formFieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  formFieldLabel: {
    color: colors.text,
    fontSize: 13,
  },
  formFieldSubLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 8,
  },
  checkboxGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  sliderRow: {
    marginTop: 4,
  },
  sliderLabel: {
    color: colors.text,
    fontSize: 13.5,
    marginBottom: 8,
  },
  sliderMockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sliderMockBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderMockBtnText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  sliderMockTrackBg: {
    flex: 1,
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  sliderMockTrackFill: {
    height: '100%',
    backgroundColor: '#6366F1',
    borderRadius: 3,
  },
  saveSettingsBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  saveSettingsText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },

  // General Settings
  formRowContainer: {
    marginBottom: 12,
  },
  inputFieldLabel: {
    color: colors.textMuted,
    fontSize: 11.5,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
  },
  toggleTitle: {
    color: colors.white,
    fontSize: 13.5,
    fontWeight: '700',
  },
  toggleSub: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
  },
  switch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchOn: {
    backgroundColor: colors.teal,
  },
  switchOff: {
    backgroundColor: colors.border,
  },
  switchKnob: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundcolor: colors.white,
  },
  switchKnobOn: {
    alignSelf: 'flex-end',
  },
  switchKnobOff: {
    alignSelf: 'flex-start',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    width: 300,
    elevation: 20,
  },
  modalEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  modalTitle: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalDetailsBox: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: 10,
    padding: 14,
    borderColor: colors.border,
    borderWidth: 1,
    marginBottom: 16,
  },
  modalFieldLabel: {
    color: colors.textMuted,
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 2,
  },
  modalFieldValue: {
    color: colors.white,
    fontSize: 13,
    marginBottom: 10,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  modalBtn: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBtnText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },

  // Mobile Header
  mobileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  mobileHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobileHeaderTitle: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '800',
  },
  mobileLogoutBtn: {
    borderColor: colors.border,
    borderWidth: 1,
    backgroundColor: colors.card,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  mobileLogoutText: {
    color: colors.text,
    fontSize: 11.5,
    fontWeight: '600',
  },

  // Mobile Bottom Navigation Bar
  mobileTabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    zIndex: 9999,
  },
  mobileTabBarScrollContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
  },
  mobileTabBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  mobileTabBtnActive: {
    backgroundColor: colors.border,
  },
  mobileTabIcon: {
    fontSize: 16,
  },
  mobileTabLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  mobileTabLabelActive: {
    color: colors.white,
  },
});
