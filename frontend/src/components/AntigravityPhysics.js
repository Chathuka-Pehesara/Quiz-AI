import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useFrameCallback,
  runOnJS
} from 'react-native-reanimated';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';

const { width, height } = Dimensions.get('window');
const SCREEN_WIDTH = width;
// Account for approximate status bar and bottom offsets
const SCREEN_HEIGHT = height - 60; 

// Physics Constants
const GRAVITY = 750; // pixels per second^2
const RESTITUTION = 0.72; // bounciness factor
const DAMPING = 0.985; // air resistance friction
function ConfettiParticle({ index, isExploded }) {
  const cx = useSharedValue(Math.random() * SCREEN_WIDTH);
  const cy = useSharedValue(-20 - Math.random() * 200);
  const cvx = useSharedValue(0);
  const cvy = useSharedValue(0);
  const crot = useSharedValue(Math.random() * 360);
  const cvrot = useSharedValue(0);

  const colors = ['#EF4444', '#3B82F6', '#10B981', '#F59E0B', '#EC4899', '#A855F7', '#06B6D4'];
  const color = colors[index % colors.length];
  const size = 6 + (index % 3) * 3;
  const borderRadius = index % 2 === 0 ? size / 2 : 2;

  useEffect(() => {
    if (isExploded) {
      cx.value = SCREEN_WIDTH / 2;
      cy.value = SCREEN_HEIGHT / 2 - 100;
      cvx.value = (Math.random() - 0.5) * 800;
      cvy.value = -Math.random() * 600 - 150;
      crot.value = Math.random() * 360;
      cvrot.value = (Math.random() - 0.5) * 20;
    } else {
      cx.value = Math.random() * SCREEN_WIDTH;
      cy.value = -50 - Math.random() * 100;
      cvx.value = 0;
      cvy.value = 0;
      crot.value = 0;
      cvrot.value = 0;
    }
  }, [isExploded]);

  useFrameCallback((frameInfo) => {
    if (!isExploded) return;
    const dt = frameInfo.timeSincePreviousFrame / 1000;
    if (dt <= 0 || dt > 0.1) return;

    cvy.value += GRAVITY * dt;
    cvx.value *= DAMPING;
    cvy.value *= DAMPING;

    cx.value += cvx.value * dt;
    cy.value += cvy.value * dt;
    crot.value += cvrot.value * dt;

    if (cx.value < 0) {
      cx.value = 0;
      cvx.value = -cvx.value * 0.5;
    } else if (cx.value > SCREEN_WIDTH - size) {
      cx.value = SCREEN_WIDTH - size;
      cvx.value = -cvx.value * 0.5;
    }

    if (cy.value > SCREEN_HEIGHT - size) {
      cy.value = SCREEN_HEIGHT - size;
      cvy.value = -cvy.value * 0.5;
      cvx.value *= 0.9;
    }
  });

  const animatedStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    width: size,
    height: size,
    backgroundColor: color,
    borderRadius: borderRadius,
    transform: [
      { translateX: cx.value },
      { translateY: cy.value },
      { rotate: `${crot.value}deg` }
    ],
    zIndex: 5
  }));

  return <Animated.View style={animatedStyle} />;
}

export default function AntigravityPhysics({ onBackHome, xpEarned = 250, streak = 7, badges = [] }) {
  const [showButton, setShowButton] = useState(false);
  const [isExploded, setIsExploded] = useState(false);

  // Home Positions
  const homes = [
    { x: SCREEN_WIDTH / 2 - 50, y: 70, w: 100, h: 100 }, // Logo
    { x: SCREEN_WIDTH / 2 - 70, y: 190, w: 140, h: 140 }, // Congrats Badge (Trophy)
    { x: 24, y: 360, w: SCREEN_WIDTH - 48, h: 140 },      // Score Card
    { x: 24, y: 530, w: SCREEN_WIDTH - 48, h: 120 }       // Action Buttons
  ];

  // Shared values for physics variables (4 elements)
  const px = [useSharedValue(homes[0].x), useSharedValue(homes[1].x), useSharedValue(homes[2].x), useSharedValue(homes[3].x)];
  const py = [useSharedValue(homes[0].y), useSharedValue(homes[1].y), useSharedValue(homes[2].y), useSharedValue(homes[3].y)];
  const vx = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const vy = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const rot = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const vrot = [useSharedValue(0), useSharedValue(0), useSharedValue(0), useSharedValue(0)];
  const isDragging = [useSharedValue(false), useSharedValue(false), useSharedValue(false), useSharedValue(false)];

  // Trigger the explosion after short initial delay to let layout load
  useEffect(() => {
    const startTimeout = setTimeout(() => {
      triggerExplosion();
    }, 800);

    // Glow button fades in after 6 seconds
    const buttonTimeout = setTimeout(() => {
      setShowButton(true);
    }, 6000);

    return () => {
      clearTimeout(startTimeout);
      clearTimeout(buttonTimeout);
    };
  }, []);

  const triggerExplosion = () => {
    setIsExploded(true);
    for (let i = 0; i < 4; i++) {
      // Eject in random directions
      vx[i].value = (Math.random() - 0.5) * 600;
      vy[i].value = -Math.random() * 400 - 150;
      vrot[i].value = (Math.random() - 0.5) * 8;
    }
  };

  const handleReset = () => {
    setIsExploded(false);
    setShowButton(false);
    // Smoothly spring all components back home
    for (let i = 0; i < 4; i++) {
      vx[i].value = 0;
      vy[i].value = 0;
      vrot[i].value = 0;
      isDragging[i].value = false;
      px[i].value = withSpring(homes[i].x, { damping: 15, stiffness: 90 });
      py[i].value = withSpring(homes[i].y, { damping: 15, stiffness: 90 });
      rot[i].value = withSpring(0, { damping: 12, stiffness: 80 });
    }
    // Fire completion callback after spring animations settle
    setTimeout(() => {
      onBackHome();
    }, 1200);
  };

  // Reanimated Physics Frame Loop Callback
  useFrameCallback((frameInfo) => {
    if (!isExploded) return;

    // Delta time in seconds
    const dt = frameInfo.timeSincePreviousFrame / 1000;
    if (dt <= 0 || dt > 0.1) return; // ignore lag spikes

    for (let i = 0; i < 4; i++) {
      if (isDragging[i].value) continue; // skip calculations for active drag

      // Apply Gravity
      vy[i].value += GRAVITY * dt;

      // Apply Air Friction
      vx[i].value *= DAMPING;
      vy[i].value *= DAMPING;
      vrot[i].value *= DAMPING;

      // Apply Velocities to position
      px[i].value += vx[i].value * dt;
      py[i].value += vy[i].value * dt;
      rot[i].value += vrot[i].value * dt;

      // Boundary Collisions
      const w = homes[i].w;
      const h = homes[i].h;

      // Left Wall
      if (px[i].value < 0) {
        px[i].value = 0;
        vx[i].value = -vx[i].value * RESTITUTION;
        vrot[i].value += vy[i].value * 0.005; // roll on wall hit
      }
      // Right Wall
      else if (px[i].value > SCREEN_WIDTH - w) {
        px[i].value = SCREEN_WIDTH - w;
        vx[i].value = -vx[i].value * RESTITUTION;
        vrot[i].value -= vy[i].value * 0.005;
      }

      // Ceiling
      if (py[i].value < 0) {
        py[i].value = 0;
        vy[i].value = -vy[i].value * RESTITUTION;
        vrot[i].value += vx[i].value * 0.005;
      }
      // Floor
      else if (py[i].value > SCREEN_HEIGHT - h) {
        py[i].value = SCREEN_HEIGHT - h;
        vy[i].value = -vy[i].value * RESTITUTION;
        // Apply ground slide friction
        vx[i].value *= 0.95;
        vrot[i].value *= 0.95;
      }
    }
  });

  // Create drag gesture builder for each component index
  const makeDragGesture = (index) => {
    let startX = 0;
    let startY = 0;
    
    return Gesture.Pan()
      .onStart(() => {
        isDragging[index].value = true;
        vx[index].value = 0;
        vy[index].value = 0;
        vrot[index].value = 0;
        startX = px[index].value;
        startY = py[index].value;
      })
      .onUpdate((event) => {
        px[index].value = startX + event.translationX;
        py[index].value = startY + event.translationY;
      })
      .onEnd((event) => {
        isDragging[index].value = false;
        // Transfer throw velocity from gesture
        vx[index].value = event.velocityX;
        vy[index].value = event.velocityY;
        vrot[index].value = event.velocityX * 0.01;
      });
  };

  // Styled animated wrappers
  const animatedStyles = [
    useAnimatedStyle(() => ({
      transform: [{ translateX: px[0].value }, { translateY: py[0].value }, { rotate: `${rot[0].value}rad` }],
      position: 'absolute',
      zIndex: isDragging[0].value ? 99 : 10,
    })),
    useAnimatedStyle(() => ({
      transform: [{ translateX: px[1].value }, { translateY: py[1].value }, { rotate: `${rot[1].value}rad` }],
      position: 'absolute',
      zIndex: isDragging[1].value ? 99 : 10,
    })),
    useAnimatedStyle(() => ({
      transform: [{ translateX: px[2].value }, { translateY: py[2].value }, { rotate: `${rot[2].value}rad` }],
      position: 'absolute',
      zIndex: isDragging[2].value ? 99 : 10,
    })),
    useAnimatedStyle(() => ({
      transform: [{ translateX: px[3].value }, { translateY: py[3].value }, { rotate: `${rot[3].value}rad` }],
      position: 'absolute',
      zIndex: isDragging[3].value ? 99 : 10,
    }))
  ];

  return (
    <GestureHandlerRootView style={styles.container}>
      {/* Confetti Particles */}
      {Array.from({ length: 30 }).map((_, i) => (
        <ConfettiParticle key={i} index={i} isExploded={isExploded} />
      ))}

      {/* 0. Logo Card */}
      <GestureDetector gesture={makeDragGesture(0)}>
        <Animated.View style={[animatedStyles[0], styles.logo]}>
          <Text style={styles.logoText}>G</Text>
          <Text style={styles.logoSubtext}>Antigravity</Text>
        </Animated.View>
      </GestureDetector>

      {/* 1. Badge Badge */}
      <GestureDetector gesture={makeDragGesture(1)}>
        <Animated.View style={[animatedStyles[1], styles.badgeContainer]}>
          <Text style={styles.badgeEmoji}>🏆</Text>
          <Text style={styles.badgeText}>PERFECT SCORE</Text>
        </Animated.View>
      </GestureDetector>

      {/* 2. Score Card */}
      <GestureDetector gesture={makeDragGesture(2)}>
        <Animated.View style={[animatedStyles[2], styles.scoreCard, { width: homes[2].w, height: homes[2].h }]}>
          <Text style={styles.cardHeader}>Quiz Results</Text>
          <Text style={styles.cardScore}>100%</Text>
          <Text style={styles.cardCongrats}>Unbelievable! You got all questions right!</Text>
          <View style={styles.floatingStatsRow}>
            <Text style={styles.floatingXp}>+{xpEarned} XP</Text>
            {streak > 0 && <Text style={styles.floatingStreak}>🔥 {streak}d Streak</Text>}
          </View>
          {badges && badges.length > 0 && (
            <Text style={styles.floatingBadgeUnlocked}>
              Unlocked: {badges[0].icon} {badges[0].name}
            </Text>
          )}
        </Animated.View>
      </GestureDetector>

      {/* 3. Action Buttons */}
      <GestureDetector gesture={makeDragGesture(3)}>
        <Animated.View style={[animatedStyles[3], styles.actionBox, { width: homes[3].w, height: homes[3].h }]}>
          <TouchableOpacity activeOpacity={0.8} style={styles.dummyBtn}>
            <Text style={styles.dummyBtnText}>Review Answers</Text>
          </TouchableOpacity>
          <TouchableOpacity activeOpacity={0.8} style={[styles.dummyBtn, styles.dummyBtnSec]}>
            <Text style={styles.dummyBtnTextSec}>Share Certificate</Text>
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>

      {/* Glowing Home Reset Button */}
      {showButton && (
        <Animated.View style={styles.backButtonContainer}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            onPress={handleReset} 
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </Animated.View>
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090D16', // Sleek deep space black
    width: '100%',
    height: '100%',
    position: 'relative'
  },
  logo: {
    backgroundColor: '#2563EB',
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 8,
      },
    }),
  },
  logoText: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '900',
  },
  logoSubtext: {
    color: '#E0F2FE',
    fontSize: 9,
    fontWeight: 'bold',
  },
  badgeContainer: {
    backgroundColor: '#1E293B',
    borderColor: '#F59E0B',
    borderWidth: 2,
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#F59E0B',
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  badgeEmoji: {
    fontSize: 48,
  },
  badgeText: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 4,
    letterSpacing: 1,
  },
  scoreCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderColor: '#334155',
    borderWidth: 1.5,
    elevation: 8,
  },
  cardHeader: {
    color: '#94A3B8',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1,
  },
  cardScore: {
    color: '#10B981',
    fontSize: 48,
    fontWeight: '900',
    marginVertical: 4,
  },
  cardCongrats: {
    color: '#E2E8F0',
    fontSize: 13,
    textAlign: 'center',
  },
  actionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    borderColor: '#1F2937',
    borderWidth: 1,
  },
  dummyBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#4B5563',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dummyBtnSec: {
    backgroundColor: 'transparent',
    borderColor: '#4B5563',
    borderWidth: 1,
  },
  dummyBtnText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  dummyBtnTextSec: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '700',
  },
  backButtonContainer: {
    position: 'absolute',
    bottom: 60,
    left: 40,
    right: 40,
    alignItems: 'center',
    zIndex: 9999,
  },
  backButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#059669',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#34D399',
    ...Platform.select({
      ios: {
        shadowColor: '#10B981',
        shadowOpacity: 0.6,
        shadowRadius: 15,
        shadowOffset: { width: 0, height: 4 },
      },
      android: {
        elevation: 10,
      },
    }),
  },
  backButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  floatingStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  floatingXp: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '800',
  },
  floatingStreak: {
    color: '#EA580C',
    fontSize: 14,
    fontWeight: '800',
  },
  floatingBadgeUnlocked: {
    color: '#F59E0B',
    fontSize: 11.5,
    fontWeight: '800',
    marginTop: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});
