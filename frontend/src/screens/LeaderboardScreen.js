import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  SafeAreaView, 
  Platform
} from 'react-native';
import Animated, { FadeInLeft, Layout } from 'react-native-reanimated';
import { api } from '../services/api';

export default function LeaderboardScreen({ navigation, route }) {
  const { colors, theme } = useTheme();
  const styles = getStyles(colors, theme);
  const [courses, setCourses] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0); // 0 = This Week, 1 = Last Week

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadLeaderboard(selectedCourse._id, weekOffset);
    }
  }, [selectedCourse, weekOffset]);

  const loadCourses = async () => {
    try {
      setLoading(true);
      const dashboard = await api.getStudentDashboard();
      if (dashboard.courses && dashboard.courses.length > 0) {
        setCourses(dashboard.courses);
        // Default to first course
        setSelectedCourse(dashboard.courses[0]);
      } else {
        setLoading(false);
      }
    } catch (err) {
      console.error('Failed to load courses for leaderboard:', err);
      setLoading(false);
    }
  };

  const loadLeaderboard = async (courseId, offset) => {
    try {
      setLeaderboardLoading(true);
      const data = await api.getLeaderboard(courseId, offset);
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
    } finally {
      setLeaderboardLoading(false);
      setLoading(false);
    }
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'Genius': return '#A855F7'; // Purple
      case 'Gold': return colors.amber; // Gold/Amber
      case 'Silver': return '#94A3B8'; // Silver/Gray
      case 'Bronze':
      default:
        return '#B45309'; // Bronze/Brown
    }
  };

  const renderLeaderboardItem = ({ item, index }) => {
    const rank = index + 1;
    const isTopThree = rank <= 3;

    return (
      <Animated.View 
        entering={FadeInLeft.delay(index * 100)}
        layout={Layout.springify()}
        style={[
          styles.leaderboardRow,
          isTopThree && styles.topRow
        ]}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, isTopThree && styles.topRankText]}>
            {getRankEmoji(rank)}
          </Text>
        </View>

        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {item.name.substring(0, 2).toUpperCase()}
          </Text>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.nameText} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.level) + '20' }]}>
            <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>
              {item.level}
            </Text>
          </View>
        </View>

        <View style={styles.scoreContainer}>
          <Text style={styles.weeklyXpText}>{item.weeklyXp} XP</Text>
          <Text style={styles.totalXpText}>Total: {item.totalXp}</Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading course leaderboards...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Course Leaderboard</Text>
        <View style={{ width: 60 }} />
      </View>

      {courses.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyEmoji}>🎓</Text>
          <Text style={styles.emptyText}>You need to enroll in a course to view rankings!</Text>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Horizontal Course Tabs */}
          <View style={styles.tabsContainer}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={courses}
              keyExtractor={(item) => item._id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[
                    styles.tabButton,
                    selectedCourse?._id === item._id && styles.activeTabButton
                  ]}
                  onPress={() => setSelectedCourse(item)}
                >
                  <Text style={[
                    styles.tabButtonText,
                    selectedCourse?._id === item._id && styles.activeTabButtonText
                  ]}>
                    {item.code}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>

          {/* Weekly Toggle */}
          <View style={styles.weeklyToggleContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.toggleBtn, weekOffset === 0 && styles.activeToggleBtn]}
              onPress={() => setWeekOffset(0)}
            >
              <Text style={[styles.toggleBtnText, weekOffset === 0 && styles.activeToggleBtnText]}>This Week</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[styles.toggleBtn, weekOffset === 1 && styles.activeToggleBtn]}
              onPress={() => setWeekOffset(1)}
            >
              <Text style={[styles.toggleBtnText, weekOffset === 1 && styles.activeToggleBtnText]}>Last Week</Text>
            </TouchableOpacity>
          </View>

          {/* List Area */}
          {leaderboardLoading ? (
            <View style={styles.listCenter}>
              <ActivityIndicator size="small" color="#6366F1" />
              <Text style={styles.loadingText}>Fetching rankings...</Text>
            </View>
          ) : (
            <FlatList
              data={leaderboard}
              keyExtractor={(item) => item.id}
              renderItem={renderLeaderboardItem}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={() => (
                <View style={styles.emptyList}>
                  <Text style={styles.emptyListText}>No activity recorded yet for this period.</Text>
                </View>
              )}
            />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors, theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop: Platform.OS === 'android' ? 36 : 0,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  listCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: colors.textMuted,
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
    backgroundColor: colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    color: colors.white,
    fontSize: 15.5,
    fontWeight: '800',
  },
  tabsContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1E',
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: colors.card,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTabButton: {
    backgroundColor: colors.primary,
    borderColor: '#6366F1',
  },
  tabButtonText: {
    color: colors.textMuted,
    fontSize: 12.5,
    fontWeight: '700',
  },
  activeTabButtonText: {
    color: colors.white,
  },
  weeklyToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: colors.card,
    padding: 3,
    borderRadius: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  activeToggleBtn: {
    backgroundColor: colors.border,
  },
  toggleBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  activeToggleBtnText: {
    color: colors.white,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  topRow: {
    borderColor: colors.amber + '40', // Highlight top 3 with golden border trace
  },
  rankContainer: {
    width: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
  topRankText: {
    fontSize: 18,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
  },
  infoContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  nameText: {
    color: colors.text,
    fontSize: 13.5,
    fontWeight: '700',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  scoreContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  weeklyXpText: {
    color: colors.teal,
    fontSize: 14,
    fontWeight: '800',
  },
  totalXpText: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyEmoji: {
    fontSize: 50,
    marginBottom: 16,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyList: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyListText: {
    color: colors.textMuted,
    fontSize: 13.5,
    textAlign: 'center',
  },
});
