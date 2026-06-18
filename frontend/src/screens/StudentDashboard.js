import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshControl,
  Platform
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { api } from '../services/api';
import { clearAuth, getRoleFromToken } from '../utils/storage';
import { scheduleSmartReminders } from '../utils/notifications';
import { getSocket, connectSocket } from '../services/socket';

export default function StudentDashboard({ navigation }) {
  const isFocused = useIsFocused();
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
  
  useEffect(() => {
    const checkRole = async () => {
      const role = await getRoleFromToken();
      if (!role) {
        Alert.alert('Access Denied', 'Please log in to continue.');
        navigation.replace('Login');
      } else {
        setUserRole(role);
      }
    };
    checkRole();
  }, []);

  const [dashboardData, setDashboardData] = useState(null);

  const [enrollCode, setEnrollCode] = useState('');
  const [battleCode, setBattleCode] = useState('');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enrollLoading, setEnrollLoading] = useState(false);
  const [practiceLoading, setPracticeLoading] = useState(false);

  // Take Quiz Modal State
  const [quizModalVisible, setQuizModalVisible] = useState(false);
  const [modalCourse, setModalCourse] = useState(null);
  const [modalQuizzes, setModalQuizzes] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  // Social & Community State
  const [activityFeed, setActivityFeed] = useState([]);
  const [activeDuels, setActiveDuels] = useState([]);
  const [duelUsername, setDuelUsername] = useState('');
  const [selectedDuelQuizId, setSelectedDuelQuizId] = useState(null);
  const [duelCourseQuizzes, setDuelCourseQuizzes] = useState({});
  const [challengeModalVisible, setChallengeModalVisible] = useState(false);

  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
    }
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      let settings = null;
      try {
        settings = await api.getAdminSettings();
        setPlatformSettings(settings);
      } catch (settingsErr) {
        console.warn('Failed to load platform settings in StudentDashboard:', settingsErr);
      }

      const profile = await api.getProfile();
      setUser(profile);

      const metrics = await api.getStudentDashboard();
      setDashboardData(metrics);

      const liveBattlesEnabled = !settings || !settings.toggles || settings.toggles.liveBattles !== false;
      if (liveBattlesEnabled) {
        try {
          const duels = await api.getActiveDuels();
          setActiveDuels(duels);
        } catch (duelErr) {
          console.warn('Failed to load active duels:', duelErr);
        }
      } else {
        setActiveDuels([]);
      }

      const notificationsEnabled = !settings || !settings.toggles || settings.toggles.pushNotifications !== false;
      if (notificationsEnabled) {
        scheduleSmartReminders(profile.activeTimes, metrics.streak, profile.lastActiveDate).catch(e =>
          console.warn('Failed to schedule notifications:', e)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      let settings = null;
      try {
        settings = await api.getAdminSettings();
        setPlatformSettings(settings);
      } catch (settingsErr) {
        console.warn('Failed to load platform settings in StudentDashboard:', settingsErr);
      }

      const profile = await api.getProfile();
      setUser(profile);
      const metrics = await api.getStudentDashboard();
      setDashboardData(metrics);

      const liveBattlesEnabled = !settings || !settings.toggles || settings.toggles.liveBattles !== false;
      if (liveBattlesEnabled) {
        try {
          const duels = await api.getActiveDuels();
          setActiveDuels(duels);
        } catch (duelErr) {
          console.warn('Failed to load active duels:', duelErr);
        }
      } else {
        setActiveDuels([]);
      }

      const notificationsEnabled = !settings || !settings.toggles || settings.toggles.pushNotifications !== false;
      if (notificationsEnabled) {
        scheduleSmartReminders(profile.activeTimes, metrics.streak, profile.lastActiveDate).catch(e =>
          console.warn('Failed to schedule notifications:', e)
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  const socketRef = React.useRef(null);

  useEffect(() => {
    if (isFocused && user && dashboardData?.courses) {
      const socket = connectSocket(user._id, user.name);
      socketRef.current = socket;

      dashboardData.courses.forEach(course => {
        socket.emit('join_course_feed', { courseId: course._id });
      });

      socket.off('activity_feed_event');
      socket.on('activity_feed_event', (event) => {
        setActivityFeed(prev => {
          if (prev.some(e => e.createdAt === event.createdAt && e.type === event.type)) return prev;
          return [event, ...prev].slice(0, 10);
        });
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.off('activity_feed_event');
      }
    };
  }, [isFocused, user, dashboardData?.courses]);

  const handleEnroll = async () => {
    if (!enrollCode) {
      Alert.alert('Error', 'Please enter a course code');
      return;
    }
    setEnrollLoading(true);
    try {
      await api.enrollCourse(enrollCode);
      Alert.alert('Success', 'Enrolled in course successfully!');
      setEnrollCode('');
      loadDashboardData();
    } catch (err) {
      Alert.alert('Enrollment Failed', err.message || 'Course code not found');
    } finally {
      setEnrollLoading(false);
    }
  };

  const handleJoinBattle = () => {
    if (battleCode.length !== 6 || isNaN(battleCode)) {
      Alert.alert('Invalid Code', 'Please enter a valid 6-digit room code');
      return;
    }
    navigation.navigate('BattleLobby', { roomCode: battleCode, user });
    setBattleCode('');
  };

  const handlePracticeWeakTopic = async () => {
    if (!dashboardData?.aiInsight?.weakTopic) return;
    setPracticeLoading(true);
    try {
      // Find the first course ID to associate practice quiz with
      const firstCourseId = dashboardData.courses?.[0]?._id;
      const practiceQuiz = await api.generatePracticeQuiz(
        dashboardData.aiInsight.weakTopic,
        firstCourseId
      );
      Alert.alert('AI Generated Quiz', 'Focused practice quiz has been generated for you!', [
        {
          text: 'Start Now ↗',
          onPress: () => navigation.navigate('Quiz', { quizId: practiceQuiz._id })
        }
      ]);
    } catch (err) {
      Alert.alert('Failed to generate practice quiz', err.message || 'Error occurred');
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleOpenQuizModal = async (course) => {
    setModalCourse(course);
    setQuizModalVisible(true);
    setModalLoading(true);
    try {
      const activeQuizzes = await api.getCourseQuizzes(course._id);
      setModalQuizzes(activeQuizzes);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to retrieve quizzes for this course.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleStartQuiz = (quizId) => {
    setQuizModalVisible(false);
    navigation.navigate('Quiz', { quizId });
  };

  const handleLogout = async () => {
    await clearAuth();
    navigation.replace('Login');
  };

  // Helper to extract initials for profile avatar
  const getInitials = (name) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Helper for progress bar color mapping
  const getProgressBarColor = (score) => {
    if (score >= 80) return '#10B981'; // Green
    if (score >= 50) return '#F59E0B'; // Orange
    return '#EF4444'; // Red
  };

  // Helper for course score badge colors
  const getBadgeColors = (score) => {
    if (score >= 80) {
      return { bg: '#ECFDF5', text: '#065F46' };
    }
    if (score >= 50) {
      return { bg: '#FEF3C7', text: '#92400E' };
    }
    return { bg: '#FEE2E2', text: '#991B1B' };
  };

  // Extract real metrics from dashboardData
  const quizzesCount = dashboardData?.quizzesCount ?? 0;
  const avgScore = dashboardData?.avgScore ?? 0;
  const badgesCount = dashboardData?.badgesCount ?? 0;
  const streak = dashboardData?.streak ?? 0;
  const freezeTokens = dashboardData?.freezeTokens ?? 0;
  const level = dashboardData?.level ?? 'Bronze';
  const xp = dashboardData?.xp ?? 0;
  const dueTopics = dashboardData?.dueTopics ?? [];
  const liveRooms = dashboardData?.liveRoomsCount ?? 0;
  const aiInsightText = dashboardData?.aiInsight?.text ?? 'Take a quiz to receive AI-driven insights!';
  const knowledgeGap = dashboardData?.knowledgeGap ?? [];
  const courses = dashboardData?.courses ?? [];

  // Calculate XP thresholds for progress bar
  let nextLevelXp = 500;
  let prevLevelXp = 0;
  if (level === 'Silver') {
    nextLevelXp = 1500;
    prevLevelXp = 500;
  } else if (level === 'Gold') {
    nextLevelXp = 4000;
    prevLevelXp = 1500;
  } else if (level === 'Genius') {
    nextLevelXp = 10000;
    prevLevelXp = 4000;
  }

  const progressPct = nextLevelXp === prevLevelXp ? 100 : Math.min(100, Math.max(0, ((xp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));
  const animatedXpWidth = useSharedValue(0);

  useEffect(() => {
    if (dashboardData) {
      animatedXpWidth.value = withSpring(progressPct, { damping: 15, stiffness: 80 });
    }
  }, [xp, progressPct, dashboardData]);

  const animatedProgressStyle = useAnimatedStyle(() => ({
    width: `${animatedXpWidth.value}%`
  }));

  if (loading && !dashboardData) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#6366F1"
            colors={['#6366F1']}
          />
        }
      >
        {/* Profile Header Row */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
            </View>
            <View style={styles.profileTextContainer}>
              <Text style={styles.welcomeText}>Welcome back</Text>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Student'}</Text>
            </View>

            {/* Streak Badge */}
            <View style={styles.streakBadge}>
              <Text style={styles.streakEmoji}>🔥</Text>
              <Text style={styles.streakText}>{streak} day streak</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {userRole === 'admin' && (
              <TouchableOpacity 
                style={[styles.logoutBtn, { borderColor: '#A855F7', marginRight: 8 }]} 
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <Text style={{ color: '#A855F7', fontWeight: '700', fontSize: 11 }}>Admin</Text>
              </TouchableOpacity>
            )}
            {(userRole === 'professor' || userRole === 'admin') && (
              <TouchableOpacity 
                style={[styles.logoutBtn, { borderColor: '#F59E0B', marginRight: 8 }]} 
                onPress={() => navigation.navigate('ProfessorDashboard')}
              >
                <Text style={{ color: '#F59E0B', fontWeight: '700', fontSize: 11 }}>Prof Console</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Level & XP Progress Card */}
        <View style={styles.xpCard}>
          <View style={styles.xpLevelRow}>
            <View style={styles.levelBadgeContainer}>
              <Text style={styles.levelBadgeText}>✨ {level}</Text>
            </View>
            <Text style={styles.xpPointsText}>{xp} / {nextLevelXp} XP</Text>
          </View>
          <View style={styles.xpBarBg}>
            <Animated.View style={[styles.xpBarFill, animatedProgressStyle]} />
          </View>
          <Text style={styles.freezeTokensText}>
            ❄️ {freezeTokens} streak freeze token{freezeTokens !== 1 ? 's' : ''} available
          </Text>
        </View>

        {/* Action Navigation Hub */}
        <View style={styles.actionHubRow}>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.hubBtn}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <Text style={styles.hubBtnEmoji}>🏆</Text>
            <Text style={styles.hubBtnText}>Leaderboards</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.hubBtn}
            onPress={() => navigation.navigate('GroupsList')}
          >
            <Text style={styles.hubBtnEmoji}>👥</Text>
            <Text style={styles.hubBtnText}>Study Groups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.hubBtn}
            onPress={() => navigation.navigate('StudyPlanner')}
          >
            <Text style={styles.hubBtnEmoji}>📅</Text>
            <Text style={styles.hubBtnText}>AI Study Plan</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Grid Dashboard Card */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Quizzes</Text>
            <Text style={styles.statValueWhite}>{quizzesCount}</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Avg score</Text>
            <Text style={styles.statValueGreen}>{avgScore}%</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <Text style={styles.statLabel}>Badges</Text>
            <Text style={styles.statValueIndigo}>{badgesCount}</Text>
          </View>
        </View>

        {/* Spaced Repetition Due Review Card */}
        {dueTopics.length > 0 && (
          <View style={styles.dueTopicsCard}>
            <View style={styles.dueHeaderRow}>
              <Text style={styles.dueIcon}>🔁</Text>
              <Text style={styles.dueTitle}>Due for Review</Text>
            </View>
            <Text style={styles.dueSubtitle}>Spaced Repetition Scheduler indicates you should review these topics:</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dueScroll}>
              {dueTopics.map((item, idx) => (
                <View key={idx} style={styles.dueItemCard}>
                  <Text style={styles.dueItemTopic} numberOfLines={1}>{item.topic}</Text>
                  <TouchableOpacity
                    style={styles.dueReviewBtn}
                    onPress={async () => {
                      try {
                        const firstCourseId = courses[0]?._id;
                        const practiceQuiz = await api.generatePracticeQuiz(item.topic, firstCourseId);
                        Alert.alert('AI Generated Review Quiz', `Ready to review "${item.topic}"?`, [
                          { text: 'Start Now ↗', onPress: () => navigation.navigate('Quiz', { quizId: practiceQuiz._id }) },
                          { text: 'Cancel', style: 'cancel' }
                        ]);
                      } catch (err) {
                        Alert.alert('Failed to launch review quiz', err.message);
                      }
                    }}
                  >
                    <Text style={styles.dueReviewBtnText}>Review ↗</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* AI Insight light-themed card */}
        <View style={styles.insightCard}>
          <View style={styles.insightHeaderRow}>
            <Text style={styles.insightIcon}>✨</Text>
            <Text style={styles.insightLabel}>AI insight</Text>
          </View>

          <Text style={styles.insightBodyText}>
            {aiInsightText.split(dashboardData?.aiInsight?.weakTopic || 'Database Normalization').map((part, index, arr) => (
              <React.Fragment key={index}>
                {part}
                {index < arr.length - 1 && (
                  <Text style={styles.insightBodyTextBold}>
                    {dashboardData?.aiInsight?.weakTopic || 'Database Normalization'}
                  </Text>
                )}
              </React.Fragment>
            ))}
          </Text>

          <TouchableOpacity
            style={styles.practiceBtn}
            onPress={handlePracticeWeakTopic}
            disabled={practiceLoading || !dashboardData?.aiInsight?.weakTopic}
          >
            {practiceLoading ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.practiceBtnText}>Practice weak topic</Text>
                <Text style={styles.practiceArrow}>↗</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Class Activity Feed */}
        <View style={styles.activityCard}>
          <Text style={styles.activityTitle}>📢 Class Activity Feed</Text>
          {activityFeed.length === 0 ? (
            <Text style={styles.emptyActivityText}>No recent class activity. Real-time updates will show up here!</Text>
          ) : (
            activityFeed.map((event, idx) => (
              <View key={idx} style={styles.activityItem}>
                <Text style={styles.activityItemText}>
                  {event.type === 'battle_created' && `⚔️ ${event.studentName} opened a battle room! Code: ${event.roomCode} for "${event.quizTitle}"`}
                  {event.type === 'quiz_published' && `📚 Professor published a new quiz: "${event.quizTitle}"!`}
                  {event.type === 'quiz_completed' && `✅ ${event.studentName} scored ${event.score}/${event.totalQuestions} on "${event.quizTitle}"`}
                  {event.type === 'badge_unlocked' && `🏆 ${event.studentName} earned the ${event.badgeIcon} ${event.badgeName} Badge!`}
                </Text>
                <Text style={styles.activityTimeText}>
                  {new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* 1v1 Async Duels Card */}
        {(!platformSettings || platformSettings.toggles?.liveBattles !== false) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardHeaderEmoji}>⚔️</Text>
                <Text style={styles.cardTitle}>1v1 Async Duels</Text>
              </View>
              <TouchableOpacity
                style={styles.challengeTriggerBtn}
                onPress={() => setChallengeModalVisible(true)}
              >
                <Text style={styles.challengeTriggerText}>Challenge Peer</Text>
              </TouchableOpacity>
            </View>

            {activeDuels.length === 0 ? (
              <Text style={styles.emptyActivityText}>No active duels. Challenge a classmate to test your speed & knowledge!</Text>
            ) : (
              activeDuels.slice(0, 3).map((duel) => {
                const isChallenger = duel.challenger?._id === user?._id;
                const opponent = isChallenger ? duel.challenged : duel.challenger;
                const myScore = isChallenger ? duel.challengerScore : duel.challengedScore;
                const opScore = isChallenger ? duel.challengedScore : duel.challengerScore;
                const opponentCompleted = isChallenger ? duel.challengedCompleted : duel.challengerCompleted;

                let duelStatusText = '';
                let canPlay = false;

                if (duel.status === 'pending') {
                  if (isChallenger) {
                    duelStatusText = `Waiting for ${opponent?.name || 'opponent'}...`;
                  } else {
                    duelStatusText = `${opponent?.name || 'Opponent'} challenged you!`;
                    canPlay = true;
                  }
                } else if (duel.status === 'completed') {
                  if (duel.winner) {
                    duelStatusText = duel.winner._id === user?._id ? 'You Won! 🎉' : 'You Lost 😢';
                  } else {
                    duelStatusText = "It's a tie! 🤝";
                  }
                } else if (duel.status === 'expired') {
                  duelStatusText = 'Expired ⏱️';
                }

                return (
                  <View key={duel._id} style={styles.duelRow}>
                    <View style={styles.duelInfo}>
                      <Text style={styles.duelOpponent}>vs {opponent?.name || 'Classmate'}</Text>
                      <Text style={styles.duelQuiz}>{duel.quiz?.title || 'Quiz'}</Text>
                      <Text style={styles.duelStatus}>{duelStatusText}</Text>
                    </View>

                    <View style={styles.duelScoreAction}>
                      <Text style={styles.duelScoreText}>
                        {myScore !== undefined ? myScore : '?'} - {opponentCompleted ? opScore : '?'}
                      </Text>
                      {canPlay && (
                        <TouchableOpacity
                          style={styles.playDuelBtn}
                          onPress={() => navigation.navigate('Quiz', { quizId: duel.quiz?._id, activeDuelId: duel._id })}
                        >
                          <Text style={styles.playDuelBtnText}>Play</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* Live Quiz Battle card */}
        {(!platformSettings || platformSettings.toggles?.liveBattles !== false) && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Text style={styles.cardHeaderEmoji}>⚡</Text>
                <Text style={styles.cardTitle}>Live quiz battle</Text>
              </View>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>{liveRooms} rooms live</Text>
              </View>
            </View>

            <View style={styles.actionRow}>
              <TextInput
                style={styles.input}
                placeholder="Enter 6-digit room code"
                placeholderTextColor="#71717A"
                keyboardType="number-pad"
                maxLength={6}
                value={battleCode}
                onChangeText={setBattleCode}
              />
              <TouchableOpacity style={styles.joinBtn} onPress={handleJoinBattle}>
                <Text style={styles.btnText}>Join</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Enroll In Class card */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Text style={styles.cardHeaderEmoji}>🎓</Text>
              <Text style={styles.cardTitle}>Enroll in class</Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <TextInput
              style={styles.input}
              placeholder="Course code (e.g. CS101)"
              placeholderTextColor="#71717A"
              autoCapitalize="characters"
              value={enrollCode}
              onChangeText={setEnrollCode}
            />
            <TouchableOpacity
              style={styles.enrollBtn}
              onPress={handleEnroll}
              disabled={enrollLoading}
            >
              {enrollLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.btnText}>Enroll</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* My Courses list */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>My courses</Text>
          <Text style={styles.sectionSubtitle}>
            {courses.length} enrolled
          </Text>
        </View>

        {courses.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>You are not enrolled in any courses yet.</Text>
          </View>
        ) : (
          courses.map((course) => {
            const badgeColors = getBadgeColors(course.avgScore);
            return (
              <View key={course._id} style={styles.courseCard}>
                <View style={styles.courseTopRow}>
                  <Text style={styles.courseNameCode}>
                    {course.code} — {course.name}
                  </Text>
                  <View style={[styles.courseScoreBadge, { backgroundColor: badgeColors.bg }]}>
                    <Text style={[styles.courseScoreText, { color: badgeColors.text }]}>
                      {course.avgScore}%
                    </Text>
                  </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.courseProgressBarBg}>
                  <View
                    style={[
                      styles.courseProgressBarFill,
                      {
                        width: `${course.avgScore}%`,
                        backgroundColor: getProgressBarColor(course.avgScore)
                      }
                    ]}
                  />
                </View>

                <View style={styles.courseBottomRow}>
                  <Text style={styles.courseQuizzesStatus}>{course.quizStatusText}</Text>
                  <TouchableOpacity
                    style={styles.takeQuizBtn}
                    onPress={() => handleOpenQuizModal(course)}
                  >
                    <Text style={styles.takeQuizBtnText}>Take quiz ↗</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}

        {/* Knowledge Gap Map Card (light themed) */}
        {knowledgeGap.length > 0 && (
          <View style={styles.gapMapCard}>
            <View style={styles.gapMapHeader}>
              <Text style={styles.gapMapIcon}>📊</Text>
              <Text style={styles.gapMapTitle}>Knowledge gap map</Text>
            </View>

            {knowledgeGap.map((item, idx) => {
              // Custom colors matching mockup styling
              let fillColor = '#6366F1'; // Default Indigo
              if (item.topic.toLowerCase().includes('normalization')) fillColor = '#EF4444'; // Red
              else if (item.topic.toLowerCase().includes('joins')) fillColor = '#6366F1'; // Purple/Indigo
              else if (item.topic.toLowerCase().includes('transactions')) fillColor = '#3B82F6'; // Blue
              else if (item.topic.toLowerCase().includes('indexing')) fillColor = '#F59E0B'; // Yellow/Amber

              return (
                <View key={idx} style={styles.gapRow}>
                  <Text style={styles.gapLabel}>{item.topic}</Text>
                  <View style={styles.gapProgressBarBg}>
                    <View
                      style={[
                        styles.gapProgressBarFill,
                        { width: `${item.accuracy}%`, backgroundColor: fillColor }
                      ]}
                    />
                  </View>
                  <Text style={styles.gapValue}>{item.accuracy}%</Text>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* High Fidelity Quizzes Selection Modal */}
      <Modal
        visible={quizModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQuizModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>Course Quizzes</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setQuizModalVisible(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCourseSubtitle}>{modalCourse?.code} — {modalCourse?.name}</Text>

            {modalLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color="#6366F1" />
                <Text style={styles.modalLoadingText}>Retrieving active quizzes...</Text>
              </View>
            ) : modalQuizzes.length === 0 ? (
              <View style={styles.modalEmptyContainer}>
                <Text style={styles.modalEmptyText}>All caught up!</Text>
                <Text style={styles.modalEmptySubtext}>No published quizzes found for this course.</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScrollable}>
                {modalQuizzes.map((quiz) => (
                  <View key={quiz._id} style={styles.modalQuizCard}>
                    <View style={styles.modalQuizInfo}>
                      <Text style={styles.modalQuizTitle}>{quiz.title}</Text>
                      <Text style={styles.modalQuizSub}>{quiz.questions.length} Adaptive Questions</Text>
                    </View>
                    <TouchableOpacity
                      style={styles.modalStartBtn}
                      onPress={() => handleStartQuiz(quiz._id)}
                    >
                      <Text style={styles.modalStartBtnText}>Start Quiz ↗</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* 1v1 Challenge Modal */}
      <Modal
        visible={challengeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChallengeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>1v1 Duel Challenge</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setChallengeModalVisible(false)}
              >
                <Text style={styles.modalCloseIcon}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCourseSubtitle}>Challenge a classmate to a quiz duel!</Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Classmate's Username"
              placeholderTextColor="#71717A"
              value={duelUsername}
              onChangeText={setDuelUsername}
              autoCapitalize="none"
            />

            <Text style={styles.modalSelectQuizLabel}>Select Quiz to Duel On:</Text>

            <ScrollView style={styles.modalScrollable}>
              {courses.map((course) => (
                <View key={course._id} style={styles.courseDuelSection}>
                  <Text style={styles.courseDuelTitle}>{course.code} — {course.name}</Text>

                  <TouchableOpacity
                    style={styles.loadCourseQuizzesBtn}
                    onPress={async () => {
                      setModalLoading(true);
                      try {
                        const activeQuizzes = await api.getCourseQuizzes(course._id);
                        setDuelCourseQuizzes(prev => ({ ...prev, [course._id]: activeQuizzes }));
                      } catch (err) {
                        Alert.alert('Error', 'Failed to retrieve quizzes.');
                      } finally {
                        setModalLoading(false);
                      }
                    }}
                  >
                    <Text style={styles.loadCourseQuizzesText}>Show Quizzes</Text>
                  </TouchableOpacity>

                  {duelCourseQuizzes[course._id]?.map((quiz) => (
                    <TouchableOpacity
                      key={quiz._id}
                      style={[
                        styles.duelQuizCard,
                        selectedDuelQuizId === quiz._id && styles.selectedDuelQuizCard
                      ]}
                      onPress={() => setSelectedDuelQuizId(quiz._id)}
                    >
                      <Text style={styles.duelQuizTitle}>{quiz.title}</Text>
                      <Text style={styles.duelQuizQuestions}>{quiz.questions.length} questions</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={[styles.modalStartBtn, (!duelUsername.trim() || !selectedDuelQuizId) && styles.disabledModalStartBtn]}
              onPress={() => {
                if (!duelUsername.trim() || !selectedDuelQuizId) return;
                setChallengeModalVisible(false);
                navigation.navigate('Quiz', {
                  quizId: selectedDuelQuizId,
                  duelChallenge: { challengedUsername: duelUsername.trim() }
                });
                setDuelUsername('');
                setSelectedDuelQuizId(null);
              }}
              disabled={!duelUsername.trim() || !selectedDuelQuizId}
            >
              <Text style={styles.modalStartBtnText}>Start Challenge Quiz ↗</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#0C0C0E',
  },
  container: {
    flex: 1,
    backgroundColor: '#0C0C0E',
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 50 : 36,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  profileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  profileTextContainer: {
    marginRight: 10,
    maxWidth: '50%',
  },
  welcomeText: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '500',
  },
  userName: {
    color: '#F4F4F5',
    fontSize: 14,
    fontWeight: '700',
  },
  streakBadge: {
    backgroundColor: '#F4FBF7',
    borderColor: '#D1FAE5',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 3,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  streakEmoji: {
    fontSize: 12,
  },
  streakText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '700',
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: '#27272A',
    backgroundColor: '#161618',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  logoutText: {
    color: '#E4E4E7',
    fontWeight: '600',
    fontSize: 12,
  },
  statsCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
  },
  statColumn: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#71717A',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValueWhite: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  statValueGreen: {
    color: '#10B981',
    fontSize: 18,
    fontWeight: '800',
  },
  statValueIndigo: {
    color: '#818CF8',
    fontSize: 18,
    fontWeight: '800',
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#262629',
  },
  insightCard: {
    backgroundColor: '#EEF2F6',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  insightHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  insightIcon: {
    fontSize: 14,
  },
  insightLabel: {
    color: '#312E81',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  insightBodyText: {
    color: '#1E1B4B',
    fontSize: 13.5,
    lineHeight: 18,
    marginBottom: 14,
  },
  insightBodyTextBold: {
    fontWeight: '700',
    color: '#1E1B4B',
  },
  practiceBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  practiceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  practiceArrow: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardHeaderEmoji: {
    fontSize: 14,
  },
  cardTitle: {
    color: '#E4E4E7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  liveBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  liveBadgeText: {
    color: '#991B1B',
    fontSize: 10.5,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 38,
    color: '#F4F4F5',
    fontSize: 13,
  },
  joinBtn: {
    backgroundColor: '#EA580C',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  enrollBtn: {
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    height: 38,
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#71717A',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
  },
  courseCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  courseTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  courseNameCode: {
    color: '#E4E4E7',
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  courseScoreBadge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  courseScoreText: {
    fontSize: 11,
    fontWeight: '700',
  },
  courseProgressBarBg: {
    height: 6,
    backgroundColor: '#27272A',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  courseProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  courseBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  courseQuizzesStatus: {
    color: '#71717A',
    fontSize: 12,
  },
  takeQuizBtn: {
    borderWidth: 1,
    borderColor: '#3F3F46',
    backgroundColor: '#161618',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  takeQuizBtnText: {
    color: '#E4E4E7',
    fontSize: 11.5,
    fontWeight: '600',
  },
  gapMapCard: {
    backgroundColor: '#EEF2F6',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 10,
  },
  gapMapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 14,
  },
  gapMapIcon: {
    fontSize: 14,
  },
  gapMapTitle: {
    color: '#0F172A',
    fontSize: 13.5,
    fontWeight: '700',
  },
  gapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  gapLabel: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '600',
    width: 90,
  },
  gapProgressBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: '#D1D5DB',
    borderRadius: 3,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  gapProgressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  gapValue: {
    color: '#334155',
    fontSize: 12.5,
    fontWeight: '700',
    width: 35,
    textAlign: 'right',
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#161618',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '75%',
    borderTopWidth: 1,
    borderTopColor: '#262629',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  modalTitleText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalCloseIconBtn: {
    padding: 4,
  },
  modalCloseIcon: {
    color: '#71717A',
    fontSize: 16,
    fontWeight: '600',
  },
  modalCourseSubtitle: {
    color: '#71717A',
    fontSize: 13,
    marginBottom: 16,
  },
  modalLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 10,
  },
  modalLoadingText: {
    color: '#71717A',
    fontSize: 13,
  },
  modalEmptyContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  modalEmptyText: {
    color: '#10B981',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalEmptySubtext: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
  },
  modalScrollable: {
    maxHeight: 300,
  },
  modalQuizCard: {
    backgroundColor: '#0C0C0E',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalQuizInfo: {
    flex: 1,
    paddingRight: 10,
  },
  modalQuizTitle: {
    color: '#E4E4E7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalQuizSub: {
    color: '#4F46E5',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 2,
  },
  modalStartBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  modalStartBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  xpCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  xpLevelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  levelBadgeContainer: {
    backgroundColor: '#3B82F6' + '20',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  levelBadgeText: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  xpPointsText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700',
  },
  xpBarBg: {
    height: 8,
    backgroundColor: '#27272A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  xpBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },
  freezeTokensText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  actionHubRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  hubBtn: {
    flex: 1,
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 6,
  },
  hubBtnEmoji: {
    fontSize: 20,
  },
  hubBtnText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700',
  },
  dueTopicsCard: {
    backgroundColor: '#161618',
    borderColor: '#EF4444' + '40',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  dueHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  dueIcon: {
    fontSize: 14,
  },
  dueTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dueSubtitle: {
    color: '#71717A',
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  dueScroll: {
    gap: 10,
    paddingRight: 12,
  },
  dueItemCard: {
    backgroundColor: '#0C0C0E',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    width: 140,
    justifyContent: 'space-between',
    gap: 8,
  },
  dueItemTopic: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '700',
  },
  dueReviewBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dueReviewBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  activityCard: {
    backgroundColor: '#161618',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
    marginBottom: 10,
  },
  emptyActivityText: {
    color: '#71717A',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    paddingVertical: 12,
  },
  activityItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#262629',
  },
  activityItemText: {
    color: '#E4E4E7',
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
    paddingRight: 8,
  },
  activityTimeText: {
    color: '#71717A',
    fontSize: 10,
  },
  challengeTriggerBtn: {
    backgroundColor: '#312E81',
    borderColor: '#4338CA',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  challengeTriggerText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  duelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0C0C0E',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#262629',
  },
  duelInfo: {
    flex: 1,
    gap: 2,
  },
  duelOpponent: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  duelQuiz: {
    color: '#818CF8',
    fontSize: 11,
  },
  duelStatus: {
    color: '#71717A',
    fontSize: 10.5,
  },
  duelScoreAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  duelScoreText: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '800',
  },
  playDuelBtn: {
    backgroundColor: '#10B981',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  playDuelBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  modalTextInput: {
    backgroundColor: '#0C0C0E',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    height: 40,
    fontSize: 13.5,
    marginBottom: 12,
  },
  modalSelectQuizLabel: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  courseDuelSection: {
    marginBottom: 12,
  },
  courseDuelTitle: {
    color: '#A1A1AA',
    fontSize: 11.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  loadCourseQuizzesBtn: {
    paddingVertical: 6,
    backgroundColor: '#27272A',
    borderRadius: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  loadCourseQuizzesText: {
    color: '#D4D4D8',
    fontSize: 11,
    fontWeight: '600',
  },
  duelQuizCard: {
    backgroundColor: '#0C0C0E',
    borderColor: '#262629',
    borderWidth: 1,
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  selectedDuelQuizCard: {
    borderColor: '#4F46E5',
    backgroundColor: '#1E1B4B',
  },
  duelQuizTitle: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  duelQuizQuestions: {
    color: '#71717A',
    fontSize: 10.5,
  },
  disabledModalStartBtn: {
    backgroundColor: '#1C1A2E',
  },
});
