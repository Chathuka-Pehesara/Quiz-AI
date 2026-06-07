import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AntigravityPhysics from '../components/AntigravityPhysics';

export default function ResultScreen({ route, navigation }) {
  const { score, total, percentage } = route.params;

  const handleGoHome = () => {
    navigation.replace('StudentDashboard');
  };

  // If student gets a perfect 100%, trigger the Antigravity Physics animation!
  if (percentage === 100) {
    return (
      <AntigravityPhysics onBackHome={handleGoHome} />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Quiz Results</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.trophyEmoji}>📝</Text>
        <Text style={styles.scoreText}>{score} / {total}</Text>
        <Text style={[
          styles.percentage,
          percentage >= 80 ? styles.highScore : percentage >= 50 ? styles.medScore : styles.lowScore
        ]}>
          {percentage}%
        </Text>
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

      <View style={styles.actionContainer}>
        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.homeBtn}
          onPress={handleGoHome}
        >
          <Text style={styles.homeBtnText}>Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
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
});
