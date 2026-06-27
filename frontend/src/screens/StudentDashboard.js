import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Platform,
  Pressable
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  Layout,
  FadeInUp,
  FadeOutUp,
  FadeInDown,
} from 'react-native-reanimated';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { api } from '../services/api';
import { clearAuth, getRoleFromToken } from '../utils/storage';
import { scheduleSmartReminders } from '../utils/notifications';
import { getSocket, connectSocket } from '../services/socket';
import { useTheme } from '../context/ThemeContext';

// 1. Premium springy scale pressable with subtle opacity changes
const AnimatedPressable = ({ children, onPress, style, disabled }) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) {
          scale.value = withSpring(0.96, { damping: 10, stiffness: 200 });
          opacity.value = withTiming(0.85, { duration: 100 });
        }
      }}
      onPressOut={() => {
        if (!disabled) {
          scale.value = withSpring(1, { damping: 10, stiffness: 200 });
          opacity.value = withTiming(1, { duration: 150 });
        }
      }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

// 2. High fidelity custom expandable deck / accordion card
const ExpandableDeck = ({ title, icon, badge, isOpen, onToggle, children }) => {
  const { colors, theme } = useTheme();
  const styles = getStyles(colors, theme);
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withSpring(isOpen ? 180 : 0, { damping: 15 });
  }, [isOpen]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      layout={Layout.springify().damping(18).stiffness(90)}
      style={[
        styles.deckCard,
        isOpen && styles.deckCardActive
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={styles.deckHeader}
      >
        <View style={styles.deckHeaderLeft}>
          <View style={[styles.deckIconBg, isOpen && styles.deckIconBgActive]}>
            {icon}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.deckTitle}>{title}</Text>
            {badge ? (
              <View style={styles.deckBadgeContainer}>
                <Text style={styles.deckSubtitle}>{badge}</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Animated.View style={arrowStyle}>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </Animated.View>
      </Pressable>
      {isOpen && (
        <Animated.View
          entering={FadeInUp.duration(300)}
          exiting={FadeOutUp.duration(200)}
          style={styles.deckBody}
        >
          {children}
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default function StudentDashboard({ navigation }) {
  const { colors, theme, toggleTheme } = useTheme();
  const styles = getStyles(colors, theme);
  const isFocused = useIsFocused();

  // Decks expanded state
  const [openDecks, setOpenDecks] = useState({
    ai: true,
    multiplayer: false,
    academics: false
  });

  const toggleDeck = (deckKey) => {
    setOpenDecks(prev => ({
      ...prev,
      [deckKey]: !prev[deckKey]
    }));
  };

  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [platformSettings, setPlatformSettings] = useState(null);
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

  // Ambient floating background particles
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);

  // Theme switcher spin rotation animation
  const themeRotation = useSharedValue(0);

  // Daily streak pulse animation
  const streakScale = useSharedValue(1);

  useEffect(() => {
    const checkRole = async () => {
      const role = await getRoleFromToken();
      if (!role) {
        Alert.alert('Access Denied', 'Please log in to continue.');
        navigation.replace('Login');
      } else if (role === 'admin') {
        navigation.replace('AdminDashboard');
      } else if (role === 'professor') {
        navigation.replace('ProfessorDashboard');
      } else {
        setUserRole(role);
      }
    };
    checkRole();

    // Start background float loop
    float1.value = withRepeat(withTiming(1, { duration: 12000 }), -1, true);
    float2.value = withRepeat(withTiming(1, { duration: 16000 }), -1, true);

    // Start daily streak pulse loop
    streakScale.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  // Animate theme toggle spin
  useEffect(() => {
    themeRotation.value = withSpring(theme === 'dark' ? 360 : 0, { damping: 12 });
  }, [theme]);

  const themeIconStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${themeRotation.value}deg` }]
  }));

  const streakAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: streakScale.value }]
  }));

  const floatStyle1 = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.sin(float1.value * Math.PI * 2) * 20 },
      { translateY: Math.cos(float1.value * Math.PI * 2) * 15 }
    ],
    opacity: theme === 'dark' ? 0.08 : 0.05
  }));

  const floatStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateX: Math.cos(float2.value * Math.PI * 2) * 25 },
      { translateY: Math.sin(float2.value * Math.PI * 2) * 20 }
    ],
    opacity: theme === 'dark' ? 0.06 : 0.03
  }));

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

  const socketRef = useRef(null);

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

  const getInitials = (name) => {
    if (!name) return 'ST';
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const getProgressBarColor = (score) => {
    if (score >= 80) return colors.teal;
    if (score >= 50) return colors.amber;
    return colors.coral;
  };

  const getBadgeColors = (score) => {
    if (score >= 80) {
      return { bg: theme === 'dark' ? '#064E3B' : '#ECFDF5', text: theme === 'dark' ? '#34D399' : '#065F46' };
    }
    if (score >= 50) {
      return { bg: theme === 'dark' ? '#78350F' : '#FEF3C7', text: theme === 'dark' ? '#FBBF24' : '#92400E' };
    }
    return { bg: theme === 'dark' ? '#7F1D1D' : '#FEE2E2', text: theme === 'dark' ? '#FCA5A5' : '#991B1B' };
  };

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
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.outerContainer}>
      {/* Decorative ambient blurred particles */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        <Animated.View style={[styles.glowParticle, floatStyle1]} />
        <Animated.View style={[styles.glowParticle2, floatStyle2]} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* Profile Header Row */}
        <View style={styles.header}>
          <View style={styles.profileInfo}>
            <View style={styles.avatarBorder}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{getInitials(user?.name)}</Text>
              </View>
            </View>
            <View style={styles.profileTextContainer}>
              <Text style={styles.welcomeText}>Welcome back,</Text>
              <Text style={styles.userName} numberOfLines={1}>{user?.name || 'Student'}</Text>
            </View>
          </View>

          {/* Controls Panel */}
          <View style={styles.controlsRow}>
            {/* Theme Toggle Button */}
            <TouchableOpacity onPress={toggleTheme} style={styles.controlIconBtn}>
              <Animated.View style={themeIconStyle}>
                <Ionicons
                  name={theme === 'dark' ? "sunny-outline" : "moon-outline"}
                  size={19}
                  color={colors.text}
                />
              </Animated.View>
            </TouchableOpacity>

            {userRole === 'admin' && (
              <TouchableOpacity
                style={[styles.consoleBtn, { borderColor: '#A855F7' }]}
                onPress={() => navigation.navigate('AdminDashboard')}
              >
                <Ionicons name="settings-outline" size={13} color="#A855F7" />
                <Text style={{ color: '#A855F7', fontWeight: '700', fontSize: 10 }}>Admin</Text>
              </TouchableOpacity>
            )}

            {(userRole === 'professor' || userRole === 'admin') && (
              <TouchableOpacity
                style={[styles.consoleBtn, { borderColor: colors.amber }]}
                onPress={() => navigation.navigate('ProfessorDashboard')}
              >
                <Ionicons name="school-outline" size={13} color={colors.amber} />
                <Text style={{ color: colors.amber, fontWeight: '700', fontSize: 10 }}>Professor</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.logoutIconBtn} onPress={handleLogout}>
              <Ionicons name="log-out-outline" size={19} color={colors.coral} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Level & XP Gamer Progress Card */}
        <View style={styles.xpCard}>
          <View style={styles.xpHeaderRow}>
            <View style={styles.levelBadge}>
              <Ionicons name="sparkles" size={12} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.levelBadgeText}>{level} Level</Text>
            </View>

            {/* Streak Badge wrapped in pulsing sequence */}
            <Animated.View style={[styles.streakBadge, streakAnimStyle]}>
              <Ionicons name="flame" size={14} color="#EF4444" />
              <Text style={styles.streakText}>{streak} Day Streak</Text>
            </Animated.View>
          </View>

          <View style={styles.xpPointsRow}>
            <Text style={styles.xpLabel}>ACQUIRED EXPERIENCE</Text>
            <Text style={styles.xpPointsText}>{xp} / {nextLevelXp} XP</Text>
          </View>

          <View style={styles.xpBarBg}>
            <Animated.View style={[styles.xpBarFill, animatedProgressStyle]} />
          </View>

          <View style={styles.xpFooter}>
            <Text style={styles.freezeTokensText}>
              ❄️ {freezeTokens} streak freeze token{freezeTokens !== 1 ? 's' : ''} available
            </Text>
            <Text style={styles.xpRemainingText}>
              {nextLevelXp - xp} XP to next level
            </Text>
          </View>
        </View>

        {/* Action Hub Row - Springy Grid */}
        <View style={styles.actionHubRow}>
          <AnimatedPressable
            style={styles.hubBtn}
            onPress={() => navigation.navigate('Leaderboard')}
          >
            <View style={[styles.hubIconBg, { backgroundColor: colors.amber + '18' }]}>
              <Ionicons name="trophy" size={20} color={colors.amber} />
            </View>
            <Text style={styles.hubBtnText}>Leaderboards</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.hubBtn}
            onPress={() => navigation.navigate('GroupsList')}
          >
            <View style={[styles.hubIconBg, { backgroundColor: colors.primary + '18' }]}>
              <Ionicons name="people" size={20} color={colors.primary} />
            </View>
            <Text style={styles.hubBtnText}>Study Groups</Text>
          </AnimatedPressable>

          <AnimatedPressable
            style={styles.hubBtn}
            onPress={() => navigation.navigate('StudyPlanner')}
          >
            <View style={[styles.hubIconBg, { backgroundColor: colors.teal + '18' }]}>
              <Ionicons name="calendar" size={20} color={colors.teal} />
            </View>
            <Text style={styles.hubBtnText}>AI Study Plan</Text>
          </AnimatedPressable>
        </View>

        {/* Stats Grid Dashboard Card */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <View style={[styles.statIconCircle, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.statLabel}>Quizzes</Text>
            <Text style={styles.statValue}>{quizzesCount}</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <View style={[styles.statIconCircle, { backgroundColor: colors.teal + '12' }]}>
              <Ionicons name="ribbon-outline" size={16} color={colors.teal} />
            </View>
            <Text style={styles.statLabel}>Avg Score</Text>
            <Text style={[styles.statValue, { color: colors.teal }]}>{avgScore}%</Text>
          </View>
          <View style={styles.statDivider} />

          <View style={styles.statColumn}>
            <View style={[styles.statIconCircle, { backgroundColor: colors.amber + '12' }]}>
              <Ionicons name="trophy-outline" size={16} color={colors.amber} />
            </View>
            <Text style={styles.statLabel}>Badges</Text>
            <Text style={[styles.statValue, { color: colors.amber }]}>{badgesCount}</Text>
          </View>
        </View>

        {/* -------------------- DECK 1: COGNITIVE HUB -------------------- */}
        <ExpandableDeck
          title="Cognitive Hub"
          icon={<MaterialCommunityIcons name="brain" size={20} color={colors.primary} />}
          badge={dueTopics.length > 0 ? `${dueTopics.length} Review Topic${dueTopics.length === 1 ? '' : 's'}` : null}
          isOpen={openDecks.ai}
          onToggle={() => toggleDeck('ai')}
        >
          {/* Spaced Repetition Due Review Card */}
          {dueTopics.length > 0 && (
            <View style={styles.dueTopicsCard}>
              <View style={styles.dueHeaderRow}>
                <Ionicons name="repeat" size={14} color={colors.coral} />
                <Text style={styles.dueTitle}>Scheduled Due Reviews</Text>
              </View>
              <Text style={styles.dueSubtitle}>Spaced repetition intervals suggest reviewing these topics now:</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dueScroll}>
                {dueTopics.map((item, idx) => (
                  <View key={idx} style={styles.dueItemCard}>
                    <Text style={styles.dueItemTopic} numberOfLines={1}>{item.topic}</Text>
                    <AnimatedPressable
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
                    </AnimatedPressable>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* AI Insight Card */}
          <View style={styles.insightCard}>
            <View style={styles.insightHeaderRow}>
              <MaterialCommunityIcons name="lightning-bolt" size={15} color={colors.primary} />
              <Text style={styles.insightLabel}>AI Insights Console</Text>
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

            <AnimatedPressable
              style={styles.practiceBtn}
              onPress={handlePracticeWeakTopic}
              disabled={practiceLoading || !dashboardData?.aiInsight?.weakTopic}
            >
              {practiceLoading ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <>
                  <Text style={styles.practiceBtnText}>Practice weak topic</Text>
                  <Ionicons name="arrow-forward" size={14} color={colors.white} />
                </>
              )}
            </AnimatedPressable>
          </View>

          {/* Knowledge Gap Map Card */}
          {knowledgeGap.length > 0 && (
            <View style={styles.gapMapCard}>
              <View style={styles.gapMapHeader}>
                <Ionicons name="bar-chart-outline" size={14} color={colors.text} />
                <Text style={styles.gapMapTitle}>Knowledge Accuracy Map</Text>
              </View>

              {knowledgeGap.map((item, idx) => {
                let fillColor = colors.primary;
                if (item.topic.toLowerCase().includes('normalization')) fillColor = colors.coral;
                else if (item.topic.toLowerCase().includes('joins')) fillColor = '#818CF8';
                else if (item.topic.toLowerCase().includes('transactions')) fillColor = colors.blue;
                else if (item.topic.toLowerCase().includes('indexing')) fillColor = colors.amber;

                return (
                  <View key={idx} style={styles.gapRow}>
                    <Text style={styles.gapLabel} numberOfLines={1}>{item.topic}</Text>
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
        </ExpandableDeck>

        {/* -------------------- DECK 2: MULTIPLAYER ARENA -------------------- */}
        <ExpandableDeck
          title="Multiplayer Arena"
          icon={<MaterialCommunityIcons name="sword-cross" size={20} color={colors.coral} />}
          badge={(!platformSettings || platformSettings.toggles?.liveBattles !== false) ? `${activeDuels.length} Active Duel${activeDuels.length === 1 ? '' : 's'}` : null}
          isOpen={openDecks.multiplayer}
          onToggle={() => toggleDeck('multiplayer')}
        >
          {(!platformSettings || platformSettings.toggles?.liveBattles !== false) && (
            <>
              {/* 1v1 Async Duels */}
              <View style={styles.arenaSubcard}>
                <View style={styles.subcardHeader}>
                  <View style={styles.subcardTitleRow}>
                    <Ionicons name="people-circle" size={18} color={colors.text} />
                    <Text style={styles.subcardTitle}>1v1 Async Duels</Text>
                  </View>
                  <AnimatedPressable
                    style={styles.challengeTriggerBtn}
                    onPress={() => setChallengeModalVisible(true)}
                  >
                    <Text style={styles.challengeTriggerText}>Challenge Peer</Text>
                  </AnimatedPressable>
                </View>

                {activeDuels.length === 0 ? (
                  <Text style={styles.emptyActivityText}>No active duels. Start a match to challenge your classmates!</Text>
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
                          <Text style={styles.duelQuiz} numberOfLines={1}>{duel.quiz?.title || 'Quiz'}</Text>
                          <Text style={styles.duelStatus}>{duelStatusText}</Text>
                        </View>

                        <View style={styles.duelScoreAction}>
                          <Text style={styles.duelScoreText}>
                            {myScore !== undefined ? myScore : '?'} - {opponentCompleted ? opScore : '?'}
                          </Text>
                          {canPlay && (
                            <AnimatedPressable
                              style={styles.playDuelBtn}
                              onPress={() => navigation.navigate('Quiz', { quizId: duel.quiz?._id, activeDuelId: duel._id })}
                            >
                              <Text style={styles.playDuelBtnText}>Play</Text>
                            </AnimatedPressable>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>

              {/* Live Quiz Battle card */}
              <View style={styles.arenaSubcard}>
                <View style={styles.subcardHeader}>
                  <View style={styles.subcardTitleRow}>
                    <Ionicons name="flash" size={16} color={colors.amber} />
                    <Text style={styles.subcardTitle}>Live Quiz Battles</Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.livePulseDot} />
                    <Text style={styles.liveBadgeText}>{liveRooms} Active</Text>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <View style={styles.inputWrapper}>
                    <Ionicons name="keypad-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="6-digit room code"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="number-pad"
                      maxLength={6}
                      value={battleCode}
                      onChangeText={setBattleCode}
                    />
                  </View>
                  <AnimatedPressable style={styles.joinBtn} onPress={handleJoinBattle}>
                    <Text style={styles.btnText}>Join</Text>
                  </AnimatedPressable>
                </View>
              </View>
            </>
          )}

          {/* Class Activity Feed */}
          <View style={styles.arenaSubcard}>
            <View style={styles.subcardHeader}>
              <View style={styles.subcardTitleRow}>
                <Ionicons name="megaphone-outline" size={16} color={colors.primary} />
                <Text style={styles.subcardTitle}>Class Activity Feed</Text>
              </View>
            </View>

            {activityFeed.length === 0 ? (
              <Text style={styles.emptyActivityText}>No recent updates. Live events appear here automatically!</Text>
            ) : (
              activityFeed.map((event, idx) => (
                <View key={idx} style={styles.activityItem}>
                  <View style={styles.activityDotContainer}>
                    <View style={[styles.activityDot, { backgroundColor: colors.primary }]} />
                  </View>
                  <View style={{ flex: 1 }}>
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
                </View>
              ))
            )}
          </View>
        </ExpandableDeck>

        {/* -------------------- DECK 3: ACADEMIC CONSOLE -------------------- */}
        <ExpandableDeck
          title="Academic Console"
          icon={<Ionicons name="school" size={20} color={colors.teal} />}
          badge={`${courses.length} Course${courses.length === 1 ? '' : 's'} Enrolled`}
          isOpen={openDecks.academics}
          onToggle={() => toggleDeck('academics')}
        >
          {/* Enroll In Class card */}
          <View style={styles.academicSubcard}>
            <Text style={styles.enrollLabel}>Enroll in a New Course</Text>
            <View style={styles.actionRow}>
              <View style={styles.inputWrapper}>
                <Ionicons name="school-outline" size={16} color={colors.textMuted} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter Course Code (e.g. CS101)"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="characters"
                  value={enrollCode}
                  onChangeText={setEnrollCode}
                />
              </View>
              <AnimatedPressable
                style={styles.enrollBtn}
                onPress={handleEnroll}
                disabled={enrollLoading}
              >
                {enrollLoading ? (
                  <ActivityIndicator color={colors.white} size="small" />
                ) : (
                  <Text style={styles.btnText}>Enroll</Text>
                )}
              </AnimatedPressable>
            </View>
          </View>

          {/* My Courses list */}
          <View style={styles.coursesListHeader}>
            <Text style={styles.subcardTitle}>Active Courses</Text>
            <Text style={styles.coursesCountText}>{courses.length} total</Text>
          </View>

          {courses.length === 0 ? (
            <View style={styles.emptyCoursesCard}>
              <Ionicons name="book-outline" size={32} color={colors.textMuted} style={{ marginBottom: 8 }} />
              <Text style={styles.emptyText}>You are not enrolled in any courses yet.</Text>
            </View>
          ) : (
            courses.map((course) => {
              const badgeColors = getBadgeColors(course.avgScore);
              return (
                <View key={course._id} style={styles.courseCard}>
                  <View style={styles.courseTopRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.courseCode}>{course.code}</Text>
                      <Text style={styles.courseName} numberOfLines={1}>{course.name}</Text>
                    </View>
                    <View style={[styles.courseScoreBadge, { backgroundColor: badgeColors.bg }]}>
                      <Text style={[styles.courseScoreText, { color: badgeColors.text }]}>
                        {course.avgScore}% avg
                      </Text>
                    </View>
                  </View>

                  {/* Progress Bar with glow */}
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
                    <AnimatedPressable
                      style={styles.takeQuizBtn}
                      onPress={() => handleOpenQuizModal(course)}
                    >
                      <Text style={styles.takeQuizBtnText}>Take Quiz</Text>
                      <Ionicons name="chevron-forward" size={10} color={colors.text} style={{ marginLeft: 2 }} />
                    </AnimatedPressable>
                  </View>
                </View>
              );
            })
          )}
        </ExpandableDeck>
      </ScrollView>

      {/* Quizzes Selection Modal */}
      <Modal
        visible={quizModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setQuizModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContent} entering={FadeInDown}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>Course Quizzes</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setQuizModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCourseSubtitle}>{modalCourse?.code} — {modalCourse?.name}</Text>

            {modalLoading ? (
              <View style={styles.modalLoadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
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
                    <AnimatedPressable
                      style={styles.modalStartBtn}
                      onPress={() => handleStartQuiz(quiz._id)}
                    >
                      <Text style={styles.modalStartBtnText}>Start Quiz</Text>
                    </AnimatedPressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </Animated.View>
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
          <Animated.View style={styles.modalContent} entering={FadeInDown}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitleText}>1v1 Duel Challenge</Text>
              <TouchableOpacity
                style={styles.modalCloseIconBtn}
                onPress={() => setChallengeModalVisible(false)}
              >
                <Ionicons name="close" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalCourseSubtitle}>Challenge a classmate to a quiz duel!</Text>

            <TextInput
              style={styles.modalTextInput}
              placeholder="Classmate's Username"
              placeholderTextColor={colors.textMuted}
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
                    <Text style={styles.loadCourseQuizzesText}>Show Available Quizzes</Text>
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

            <AnimatedPressable
              style={[styles.modalStartBtn, { marginTop: 16 }, (!duelUsername.trim() || !selectedDuelQuizId) && styles.disabledModalStartBtn]}
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
              <Text style={styles.modalStartBtnText}>Start Challenge Quiz</Text>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors, theme) => {
  const isDark = theme === 'dark';
  return StyleSheet.create({
    outerContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'ios' ? 54 : 38,
      paddingBottom: 40,
    },
    glowParticle: {
      position: 'absolute',
      width: 180,
      height: 180,
      borderRadius: 90,
      backgroundColor: colors.primary,
      top: '15%',
      left: '-15%',
    },
    glowParticle2: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      backgroundColor: colors.teal,
      bottom: '25%',
      right: '-15%',
    },
    center: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 22,
    },
    profileInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: 10,
    },
    avatarBorder: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1.5,
      borderColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 12,
    },
    avatar: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    profileTextContainer: {
      flex: 1,
    },
    welcomeText: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '500',
    },
    userName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    controlIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    consoleBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      borderWidth: 1,
      backgroundColor: colors.card,
      paddingVertical: 5,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    logoutIconBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    xpCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      padding: 16,
      marginBottom: 16,
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.12 : 0.04,
      shadowRadius: 12,
      elevation: 3,
    },
    xpHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 14,
    },
    levelBadge: {
      backgroundColor: colors.primary + '18',
      paddingVertical: 4,
      paddingHorizontal: 10,
      borderRadius: 8,
      flexDirection: 'row',
      alignItems: 'center',
    },
    levelBadgeText: {
      color: colors.primary,
      fontSize: 10.5,
      fontWeight: '800',
      textTransform: 'uppercase',
    },
    streakBadge: {
      backgroundColor: isDark ? '#1F1212' : '#FEF2F2',
      borderColor: isDark ? '#4A1D1D' : '#FEE2E2',
      borderWidth: 1,
      borderRadius: 12,
      paddingVertical: 4,
      paddingHorizontal: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    streakText: {
      color: '#EF4444',
      fontSize: 10.5,
      fontWeight: '800',
    },
    xpPointsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginBottom: 6,
    },
    xpLabel: {
      color: colors.textMuted,
      fontSize: 9.5,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    xpPointsText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
    },
    xpBarBg: {
      height: 10,
      backgroundColor: isDark ? '#1E293B' : '#E2E8F0',
      borderRadius: 5,
      overflow: 'hidden',
      marginBottom: 10,
    },
    xpBarFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 5,
    },
    xpFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    freezeTokensText: {
      color: '#38BDF8',
      fontSize: 10.5,
      fontWeight: '600',
    },
    xpRemainingText: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: '500',
    },
    actionHubRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 16,
    },
    hubBtn: {
      flex: 1,
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
      gap: 8,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.1 : 0.02,
      shadowRadius: 4,
      elevation: 2,
    },
    hubIconBg: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    hubBtnText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    statsCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 16,
      paddingVertical: 14,
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      marginBottom: 18,
      shadowColor: colors.black,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: isDark ? 0.08 : 0.01,
      shadowRadius: 6,
      elevation: 1,
    },
    statColumn: {
      alignItems: 'center',
      flex: 1,
    },
    statIconCircle: {
      width: 28,
      height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 4,
    },
    statLabel: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 2,
    },
    statValue: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    statDivider: {
      width: 1,
      height: 32,
      backgroundColor: colors.border,
    },
    deckCard: {
      borderWidth: 1,
      borderRadius: 16,
      marginBottom: 12,
      overflow: 'hidden',
      shadowOffset: { width: 0, height: 4 },
      shadowRadius: 8,
      elevation: 2,
    },
    deckCardActive: {
      borderWidth: 1.2,
    },
    deckHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    deckHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },
    deckIconBg: {
      width: 36,
      height: 36,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deckIconBgActive: {
      transform: [{ scale: 1.05 }],
    },
    deckTitle: {
      fontSize: 14,
      fontWeight: '800',
    },
    deckBadgeContainer: {
      alignSelf: 'flex-start',
      marginTop: 2,
    },
    deckSubtitle: {
      fontSize: 11,
      fontWeight: '600',
      color: colors.primary,
    },
    deckBody: {
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    dueTopicsCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 12,
    },
    dueHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dueTitle: {
      color: colors.coral,
      fontSize: 11.5,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    dueSubtitle: {
      color: colors.textMuted,
      fontSize: 10.5,
      lineHeight: 14,
      marginBottom: 10,
    },
    dueScroll: {
      gap: 8,
    },
    dueItemCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      padding: 8,
      width: 130,
      justifyContent: 'space-between',
      gap: 6,
    },
    dueItemTopic: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
    },
    dueReviewBtn: {
      backgroundColor: colors.coral,
      borderRadius: 6,
      paddingVertical: 5,
      alignItems: 'center',
    },
    dueReviewBtnText: {
      color: colors.white,
      fontSize: 9.5,
      fontWeight: '800',
    },
    insightCard: {
      backgroundColor: isDark ? '#1E2235' : '#EEF2F6',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    insightHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    },
    insightLabel: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    insightBodyText: {
      color: colors.text,
      fontSize: 13,
      lineHeight: 18,
      marginBottom: 12,
    },
    insightBodyTextBold: {
      fontWeight: '800',
      color: colors.primary,
    },
    practiceBtn: {
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
    },
    practiceBtnText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '700',
    },
    gapMapCard: {
      backgroundColor: isDark ? '#151D30' : '#F1F5F9',
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 4,
    },
    gapMapHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 12,
    },
    gapMapTitle: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    gapRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    gapLabel: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '600',
      width: 90,
    },
    gapProgressBarBg: {
      flex: 1,
      height: 6,
      backgroundColor: isDark ? '#2D3748' : '#D1D5DB',
      borderRadius: 3,
      marginHorizontal: 10,
      overflow: 'hidden',
    },
    gapProgressBarFill: {
      height: '100%',
      borderRadius: 3,
    },
    gapValue: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '700',
      width: 32,
      textAlign: 'right',
    },
    arenaSubcard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 10,
    },
    subcardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 10,
    },
    subcardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    subcardTitle: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '800',
    },
    challengeTriggerBtn: {
      backgroundColor: colors.primary + '18',
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    challengeTriggerText: {
      color: colors.primary,
      fontSize: 10.5,
      fontWeight: '800',
    },
    emptyActivityText: {
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 15,
      textAlign: 'center',
      paddingVertical: 14,
    },
    duelRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 10,
      padding: 10,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: colors.border,
    },
    duelInfo: {
      flex: 1,
      gap: 2,
    },
    duelOpponent: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '700',
    },
    duelQuiz: {
      color: colors.primary,
      fontSize: 10.5,
      fontWeight: '500',
    },
    duelStatus: {
      color: colors.textMuted,
      fontSize: 10,
    },
    duelScoreAction: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    duelScoreText: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
    },
    playDuelBtn: {
      backgroundColor: colors.teal,
      borderRadius: 6,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    playDuelBtnText: {
      color: colors.white,
      fontSize: 10.5,
      fontWeight: '800',
    },
    liveBadge: {
      backgroundColor: '#FEF2F2',
      borderRadius: 10,
      paddingVertical: 3,
      paddingHorizontal: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    livePulseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: '#EF4444',
    },
    liveBadgeText: {
      color: '#991B1B',
      fontSize: 9.5,
      fontWeight: '800',
    },
    actionRow: {
      flexDirection: 'row',
      gap: 8,
    },
    inputWrapper: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      paddingHorizontal: 10,
      height: 38,
    },
    inputIcon: {
      marginRight: 6,
    },
    input: {
      flex: 1,
      height: '100%',
      color: colors.text,
      fontSize: 12,
    },
    joinBtn: {
      backgroundColor: colors.amber,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      height: 38,
    },
    enrollBtn: {
      backgroundColor: colors.teal,
      borderRadius: 10,
      paddingHorizontal: 14,
      justifyContent: 'center',
      alignItems: 'center',
      height: 38,
    },
    btnText: {
      color: colors.white,
      fontSize: 12,
      fontWeight: '800',
    },
    activityItem: {
      flexDirection: 'row',
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    activityDotContainer: {
      width: 14,
      alignItems: 'center',
      paddingTop: 4,
    },
    activityDot: {
      width: 5,
      height: 5,
      borderRadius: 2.5,
    },
    activityItemText: {
      color: colors.text,
      fontSize: 11.5,
      lineHeight: 15,
    },
    activityTimeText: {
      color: colors.textMuted,
      fontSize: 9.5,
      marginTop: 2,
    },
    academicSubcard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 14,
    },
    enrollLabel: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: '800',
      marginBottom: 8,
      textTransform: 'uppercase',
    },
    coursesListHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
      marginTop: 4,
    },
    coursesCountText: {
      color: colors.textMuted,
      fontSize: 11,
    },
    emptyCoursesCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyText: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    courseCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
    },
    courseTopRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    courseCode: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '800',
    },
    courseName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    courseScoreBadge: {
      paddingVertical: 3,
      paddingHorizontal: 8,
      borderRadius: 8,
    },
    courseScoreText: {
      fontSize: 10,
      fontWeight: '800',
    },
    courseProgressBarBg: {
      height: 5,
      backgroundColor: isDark ? '#2D3748' : '#E2E8F0',
      borderRadius: 2.5,
      overflow: 'hidden',
      marginBottom: 8,
    },
    courseProgressBarFill: {
      height: '100%',
      borderRadius: 2.5,
    },
    courseBottomRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    courseQuizzesStatus: {
      color: colors.textMuted,
      fontSize: 11,
    },
    takeQuizBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingVertical: 5,
      paddingHorizontal: 10,
    },
    takeQuizBtnText: {
      color: colors.text,
      fontSize: 10.5,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 20,
      paddingBottom: 40,
      maxHeight: '75%',
      borderTopWidth: 1.5,
      borderTopColor: colors.primary + '30',
    },
    modalHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 4,
    },
    modalTitleText: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    modalCloseIconBtn: {
      padding: 4,
    },
    modalCourseSubtitle: {
      color: colors.textMuted,
      fontSize: 12.5,
      marginBottom: 16,
    },
    modalLoadingContainer: {
      paddingVertical: 40,
      alignItems: 'center',
      gap: 10,
    },
    modalLoadingText: {
      color: colors.textMuted,
      fontSize: 12,
    },
    modalEmptyContainer: {
      paddingVertical: 40,
      alignItems: 'center',
    },
    modalEmptyText: {
      color: colors.teal,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    modalEmptySubtext: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    modalScrollable: {
      maxHeight: 300,
    },
    modalQuizCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 8,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    modalQuizInfo: {
      flex: 1,
      paddingRight: 10,
    },
    modalQuizTitle: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    modalQuizSub: {
      color: colors.primary,
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
    },
    modalStartBtn: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
    },
    modalStartBtnText: {
      color: colors.white,
      fontSize: 11,
      fontWeight: '800',
    },
    modalTextInput: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 10,
      color: colors.text,
      paddingHorizontal: 12,
      height: 40,
      fontSize: 13,
      marginBottom: 12,
    },
    modalSelectQuizLabel: {
      color: colors.text,
      fontSize: 12.5,
      fontWeight: '800',
      marginBottom: 8,
    },
    courseDuelSection: {
      marginBottom: 12,
    },
    courseDuelTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginBottom: 6,
    },
    loadCourseQuizzesBtn: {
      paddingVertical: 6,
      backgroundColor: colors.border,
      borderRadius: 8,
      alignItems: 'center',
      marginBottom: 6,
    },
    loadCourseQuizzesText: {
      color: colors.text,
      fontSize: 11,
      fontWeight: '600',
    },
    duelQuizCard: {
      backgroundColor: colors.background,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 8,
      padding: 8,
      marginBottom: 6,
    },
    selectedDuelQuizCard: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '12',
    },
    duelQuizTitle: {
      color: colors.text,
      fontSize: 11.5,
      fontWeight: '600',
    },
    duelQuizQuestions: {
      color: colors.textMuted,
      fontSize: 10,
    },
    disabledModalStartBtn: {
      backgroundColor: isDark ? '#1C1A2E' : '#E2E8F0',
    },
  });
};
