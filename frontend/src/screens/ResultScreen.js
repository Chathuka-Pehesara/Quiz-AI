import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions, Share, Alert, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import ViewShot from 'react-native-view-shot';
import AntigravityPhysics from '../components/AntigravityPhysics';

const { width } = Dimensions.get('window');

export default function ResultScreen({ route, navigation }) {
  const { 
    score, 
    total, 
    percentage, 
    xpEarned = 0, 
    streak = 0, 
    freezeTokens = 0,
    streakProtected = false,
    badgesUnlocked = [] 
  } = route.params;

  const [activeBadgeIdx, setActiveBadgeIdx] = useState(-1);
  const [badgeModalVisible, setBadgeModalVisible] = useState(false);
  const viewShotRef = useRef(null);

  // Reanimated values for badge popup
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (badgesUnlocked && badgesUnlocked.length > 0) {
      setActiveBadgeIdx(0);
      setBadgeModalVisible(true);
    }
  }, [badgesUnlocked]);

  useEffect(() => {
    if (badgeModalVisible) {
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      scale.value = 0.3;
      opacity.value = 0;
    }
  }, [badgeModalVisible, activeBadgeIdx]);

  const animatedBadgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value
  }));

  const handleNextBadge = () => {
    if (activeBadgeIdx < badgesUnlocked.length - 1) {
      setActiveBadgeIdx(prev => prev + 1);
    } else {
      setBadgeModalVisible(false);
      setActiveBadgeIdx(-1);
    }
  };

  const handleGoHome = () => {
    navigation.replace('StudentDashboard');
  };

  const handleShare = async () => {
    try {
      if (!viewShotRef.current) return;
      const uri = await viewShotRef.current.capture();
      await Share.share({
        url: Platform.OS === 'android' ? uri : undefined,
        message: `I scored ${score}/${total} (${percentage}%) on Quiz AI Platform! Check out my score!`,
        title: 'Quiz AI Platform Results'
      });
    } catch (err) {
      console.error('Failed to capture or share:', err);
      Alert.alert('Share Failed', 'Could not generate shareable card image.');
    }
  };

  // If student gets a perfect 100%, trigger the Antigravity Physics animation!
  if (percentage === 100) {
    return (
      <AntigravityPhysics 
        onBackHome={handleGoHome} 
        xpEarned={xpEarned} 
        streak={streak} 
        badges={badgesUnlocked}
      />
    );
  }

  const activeBadge = activeBadgeIdx >= 0 ? badgesUnlocked[activeBadgeIdx] : null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quiz Results</Text>
      </View>

      <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.9 }} style={styles.viewShotCard}>
        <View style={styles.card}>
          <Text style={styles.trophyEmoji}>📝</Text>
          <Text style={styles.scoreText}>{score} / {total}</Text>
          <Text style={[
            styles.percentage,
            percentage >= 80 ? styles.highScore : percentage >= 50 ? styles.medScore : styles.lowScore
          ]}>
            {percentage}%
          </Text>
          
          {/* Gamification summary row */}
          <View style={styles.gamificationRow}>
            <View style={styles.xpPill}>
              <Text style={styles.xpPillText}>+{xpEarned} XP</Text>
            </View>
            {streak > 0 && (
              <View style={styles.streakPill}>
                <Text style={styles.streakPillText}>🔥 {streak} Day Streak</Text>
              </View>
            )}
          </View>

          {streakProtected && (
            <View style={styles.streakProtectedBox}>
              <Text style={styles.streakProtectedText}>❄️ Streak Freeze Used to protect your streak!</Text>
            </View>
          )}

          <Text style={styles.description}>
            {percentage >= 80 ? 'Excellent work! You have strong grasp of this topic.' : 
             percentage >= 50 ? 'Good effort! Review your weak topics to improve.' : 
             'Keep practicing! Check your Knowledge Gap chart on the dashboard.'}
          </Text>
          
          {percentage < 100 && (
            <View style={styles.easterEggHintBox}>
              <Text style={styles.easterEggHintText}>
                🔒 Easter Egg: Score 100% to break gravity and unlock the physics playground!
              </Text>
            </View>
          )}
        </View>
      </ViewShot>

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.shareBtn}
          onPress={handleShare}
        >
          <Text style={styles.shareBtnText}>Share Results Card 📲</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.homeBtn}
          onPress={handleGoHome}
        >
          <Text style={styles.homeBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>

      {/* Animated Badge Unlock Celebration Modal */}
      {activeBadge && (
        <Modal
          visible={badgeModalVisible}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.modalOverlay}>
            <Animated.View style={[styles.modalContent, animatedBadgeStyle]}>
              <Text style={styles.unlockedTitle}>✨ BADGE UNLOCKED! ✨</Text>
              
              <View style={styles.badgeIconContainer}>
                <Text style={styles.badgeIcon}>{activeBadge.icon}</Text>
              </View>

              <Text style={styles.badgeName}>{activeBadge.name}</Text>
              <Text style={styles.badgeDesc}>{activeBadge.description}</Text>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.badgeCloseBtn}
                onPress={handleNextBadge}
              >
                <Text style={styles.badgeCloseBtnText}>
                  {activeBadgeIdx < badgesUnlocked.length - 1 ? 'Next Badge ↗' : 'Awesome!'}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1.5,
    elevation: 4,
  },
  trophyEmoji: {
    fontSize: 60,
    marginBottom: 12,
  },
  scoreText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  percentage: {
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 10,
  },
  highScore: { color: '#10B981' },
  medScore: { color: '#F59E0B' },
  lowScore: { color: '#EF4444' },
  description: {
    color: '#E2E8F0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  easterEggHintBox: {
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    marginTop: 20,
    borderColor: '#334155',
    borderWidth: 1,
  },
  easterEggHintText: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  actionContainer: {
    marginTop: 30,
  },
  homeBtn: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  homeBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  gamificationRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  xpPill: {
    backgroundColor: '#10B981' + '20',
    borderColor: '#10B981',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  xpPillText: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
  },
  streakPill: {
    backgroundColor: '#EA580C' + '20',
    borderColor: '#EA580C',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  streakPillText: {
    color: '#EA580C',
    fontSize: 12,
    fontWeight: '800',
  },
  streakProtectedBox: {
    backgroundColor: '#0EA5E9' + '20',
    borderColor: '#0EA5E9',
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginBottom: 14,
    width: '100%',
  },
  streakProtectedText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderColor: '#F59E0B',
    borderWidth: 2,
    borderRadius: 20,
    padding: 24,
    width: width - 48,
    alignItems: 'center',
    elevation: 24,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  unlockedTitle: {
    color: '#F59E0B',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: 16,
    textAlign: 'center',
  },
  badgeIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  badgeIcon: {
    fontSize: 48,
  },
  badgeName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  badgeDesc: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 24,
  },
  badgeCloseBtn: {
    backgroundColor: '#F59E0B',
    borderRadius: 12,
    height: 48,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeCloseBtnText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  viewShotCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    overflow: 'hidden',
  },
  shareBtn: {
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  shareBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
