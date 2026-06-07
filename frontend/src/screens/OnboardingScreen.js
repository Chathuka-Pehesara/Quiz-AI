import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  Dimensions, 
  TouchableOpacity, 
  Animated as RNAnimated 
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming 
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { storeOnboardingRole } from '../utils/storage';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import PrimaryButton from '../components/PrimaryButton';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function OnboardingScreen({ navigation }) {
  const { colors } = useTheme();
  const scrollViewRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedRole, setSelectedRole] = useState(null); // 'student' | 'professor'

  // Role card animation values
  const studentScale = useSharedValue(1);
  const professorScale = useSharedValue(1);

  const selectRole = (role) => {
    setSelectedRole(role);
    if (role === 'student') {
      studentScale.value = withSpring(1.05);
      professorScale.value = withSpring(0.95);
    } else {
      studentScale.value = withSpring(0.95);
      professorScale.value = withSpring(1.05);
    }
  };

  const studentAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: studentScale.value }],
  }));

  const professorAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: professorScale.value }],
  }));

  const handleNext = async () => {
    if (activeIndex === 1 && !selectedRole) {
      alert('Please select a role to continue.');
      return;
    }

    if (activeIndex < 2) {
      scrollViewRef.current?.scrollTo({
        x: (activeIndex + 1) * SCREEN_WIDTH,
        animated: true,
      });
      setActiveIndex(activeIndex + 1);
    } else {
      // Complete onboarding
      await storeOnboardingRole(selectedRole);
      navigation.replace('Login');
    }
  };

  const handleScroll = (event) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index !== activeIndex) {
      setActiveIndex(index);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Horizontal Swipeable Content */}
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {/* Screen 1: Welcome */}
        <View style={styles.slide}>
          <Text style={styles.emoji}>🎓</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            Welcome to Quiz<Text style={{ color: colors.primary }}>AI</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.textMuted }]}>
            University Intelligent Adaptive Exam & Real-Time Multiplayer Suite
          </Text>
        </View>

        {/* Screen 2: Role Selection */}
        <View style={styles.slide}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Choose Your Role</Text>
          <Text style={[styles.screenSubtitle, { color: colors.textMuted }]}>
            Select your primary account profile to customize your dashboard
          </Text>

          <View style={styles.rolesRow}>
            {/* Student Option */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => selectRole('student')}
              style={styles.cardTouch}
            >
              <Animated.View style={[
                styles.roleCard, 
                studentAnimStyle,
                { 
                  backgroundColor: colors.card,
                  borderColor: selectedRole === 'student' ? colors.primary : colors.border,
                  borderWidth: selectedRole === 'student' ? 2 : 1
                }
              ]}>
                <Text style={styles.roleEmoji}>👥</Text>
                <Text style={[styles.roleName, { color: colors.text }]}>Student</Text>
                <Text style={[styles.roleDesc, { color: colors.textMuted }]}>
                  Take adaptive tests, track knowledge gaps, and join live quiz battles
                </Text>
              </Animated.View>
            </TouchableOpacity>

            {/* Professor Option */}
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => selectRole('professor')}
              style={styles.cardTouch}
            >
              <Animated.View style={[
                styles.roleCard, 
                professorAnimStyle,
                { 
                  backgroundColor: colors.card,
                  borderColor: selectedRole === 'professor' ? colors.primary : colors.border,
                  borderWidth: selectedRole === 'professor' ? 2 : 1
                }
              ]}>
                <Text style={styles.roleEmoji}>🎓</Text>
                <Text style={[styles.roleName, { color: colors.text }]}>Professor</Text>
                <Text style={[styles.roleDesc, { color: colors.textMuted }]}>
                  Generate syllabus exams with AI, host battles, and view cohort metrics
                </Text>
              </Animated.View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Screen 3: Feature Highlights */}
        <View style={styles.slide}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>Platform Highlights</Text>
          
          <View style={styles.featuresList}>
            <View style={[styles.featureItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.featureEmoji}>⚡</Text>
              <View style={styles.featureTexts}>
                <Text style={[styles.featureName, { color: colors.text }]}>Claude 3.5 Sonnet Integration</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Generates deep, customized question banks directly from lecture uploads.
                </Text>
              </View>
            </View>

            <View style={[styles.featureItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.featureEmoji}>🎮</Text>
              <View style={styles.featureTexts}>
                <Text style={[styles.featureName, { color: colors.text }]}>Live Classroom Battles</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Engage in multiplayer games in sync with classmates.
                </Text>
              </View>
            </View>

            <View style={[styles.featureItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={styles.featureEmoji}>📊</Text>
              <View style={styles.featureTexts}>
                <Text style={[styles.featureName, { color: colors.text }]}>Knowledge Gap Profiling</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>
                  Adaptive engines find and help study your weakest topics.
                </Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Pagination Footer */}
      <View style={styles.footer}>
        <View style={styles.dotsRow}>
          {[0, 1, 2].map((i) => (
            <View 
              key={i} 
              style={[
                styles.dot, 
                { 
                  backgroundColor: i === activeIndex ? colors.primary : colors.border,
                  width: i === activeIndex ? 18 : 8
                }
              ]} 
            />
          ))}
        </View>

        <PrimaryButton
          title={activeIndex === 2 ? 'Get Started' : 'Next'}
          onPress={handleNext}
          style={styles.nextButton}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emoji: {
    fontSize: 80,
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xxxl,
    fontWeight: TYPOGRAPHY.weights.black,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  tagline: {
    fontSize: TYPOGRAPHY.sizes.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.md,
  },
  screenTitle: {
    fontSize: TYPOGRAPHY.sizes.xxl,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  screenSubtitle: {
    fontSize: TYPOGRAPHY.sizes.sm,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: SPACING.xl,
  },
  rolesRow: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  cardTouch: {
    flex: 1,
  },
  roleCard: {
    borderRadius: BORDER_RADIUS.md,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    height: 200,
    justifyContent: 'center',
  },
  roleEmoji: {
    fontSize: 32,
    marginBottom: SPACING.xs,
  },
  roleName: {
    fontSize: TYPOGRAPHY.sizes.lg,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: SPACING.xs,
  },
  roleDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  featuresList: {
    width: '100%',
    gap: 14,
  },
  featureItem: {
    flexDirection: 'row',
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
  },
  featureEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  featureTexts: {
    flex: 1,
  },
  featureName: {
    fontSize: TYPOGRAPHY.sizes.md,
    fontWeight: TYPOGRAPHY.weights.bold,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 11,
    lineHeight: 15,
  },
  footer: {
    height: SCREEN_HEIGHT * 0.25,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: SPACING.xl,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextButton: {
    width: '100%',
    height: 48,
  },
});
