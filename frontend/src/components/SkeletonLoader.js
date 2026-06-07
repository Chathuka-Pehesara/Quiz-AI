import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../constants/theme';

export default function SkeletonLoader({ variant = 'card', style = {} }) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.75, { duration: 650 }),
        withTiming(0.35, { duration: 650 })
      ),
      -1, // infinite repetitions
      true // reverse loop (pulse)
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Shimmer block color is slightly lighter than card/bg background depending on theme
  const skeletonBg = colors.border;

  if (variant === 'card') {
    return (
      <View style={[styles.cardContainer, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
        <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '40%', height: 16 }]} />
        <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '90%', height: 12, marginTop: SPACING.md }]} />
        <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '70%', height: 12, marginTop: SPACING.sm }]} />
      </View>
    );
  }

  if (variant === 'listItem') {
    return (
      <View style={[styles.listContainer, { borderBottomColor: colors.border }, style]}>
        <View style={styles.listRow}>
          <Animated.View style={[styles.shimmerCircle, animatedStyle, { backgroundColor: skeletonBg }]} />
          <View style={styles.listContent}>
            <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '60%', height: 14 }]} />
            <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '40%', height: 10, marginTop: SPACING.xs }]} />
          </View>
        </View>
      </View>
    );
  }

  if (variant === 'statCard') {
    return (
      <View style={[styles.statContainer, { backgroundColor: colors.card, borderColor: colors.border }, style]}>
        <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '70%', height: 11 }]} />
        <Animated.View style={[styles.shimmerCircle, animatedStyle, { backgroundColor: skeletonBg, width: 22, height: 22, borderRadius: 11, marginVertical: SPACING.xs }]} />
        <Animated.View style={[styles.shimmerLine, animatedStyle, { backgroundColor: skeletonBg, width: '45%', height: 22 }]} />
      </View>
    );
  }

  return (
    <Animated.View style={[styles.baseShimmer, animatedStyle, { backgroundColor: skeletonBg }, style]} />
  );
}

const styles = StyleSheet.create({
  baseShimmer: {
    borderRadius: BORDER_RADIUS.xs,
  },
  cardContainer: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  shimmerLine: {
    borderRadius: BORDER_RADIUS.xs,
  },
  shimmerCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  listContainer: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  listContent: {
    marginLeft: 12,
    flex: 1,
  },
  statContainer: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: 12,
  },
});
