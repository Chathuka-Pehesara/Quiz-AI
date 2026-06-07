import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

const AnalyticsChart = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No quiz results recorded yet.</Text>
        <Text style={styles.emptySubtext}>Complete a quiz to unlock knowledge gap insights!</Text>
      </View>
    );
  }

  // Find strongest and weakest topics
  const sortedData = [...data].sort((a, b) => b.accuracy - a.accuracy);
  const strongest = sortedData[0];
  const weakest = sortedData[sortedData.length - 1];

  const getStatusColor = (acc) => {
    if (acc < 50) return '#EF4444'; // Red
    if (acc < 80) return '#F59E0B'; // Amber
    return '#10B981'; // Green
  };

  const getStatusLabel = (acc) => {
    if (acc < 50) return 'Weak / Critical';
    if (acc < 80) return 'Developing';
    return 'Mastered / Strong';
  };

  return (
    <View style={styles.container}>
      <Text style={styles.headerTitle}>Knowledge Performance Profile</Text>

      {/* Summary Badges */}
      <View style={styles.summaryRow}>
        {strongest && (
          <View style={[styles.summaryCard, { borderColor: '#10B981' }]}>
            <Text style={styles.summaryLabel}>Strongest Topic</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>{strongest.topic}</Text>
            <Text style={[styles.summaryAccuracy, { color: '#10B981' }]}>{strongest.accuracy}% Mastery</Text>
          </View>
        )}
        {weakest && weakest.topic !== strongest.topic && (
          <View style={[styles.summaryCard, { borderColor: '#EF4444' }]}>
            <Text style={styles.summaryLabel}>Needs Review</Text>
            <Text style={styles.summaryValue} numberOfLines={1}>{weakest.topic}</Text>
            <Text style={[styles.summaryAccuracy, { color: '#EF4444' }]}>{weakest.accuracy}% Accuracy</Text>
          </View>
        )}
      </View>

      {/* Visual Bar Chart */}
      <View style={styles.chartContainer}>
        {data.map((item, idx) => {
          const barColor = getStatusColor(item.accuracy);
          const statusText = getStatusLabel(item.accuracy);
          
          return (
            <View key={idx} style={styles.barItem}>
              <View style={styles.barHeader}>
                <Text style={styles.topicName}>{item.topic}</Text>
                <Text style={[styles.topicAccuracy, { color: barColor }]}>
                  {item.accuracy}% ({item.correct}/{item.total})
                </Text>
              </View>
              
              {/* Progress Bar Container */}
              <View style={styles.progressBarBg}>
                <View 
                  style={[
                    styles.progressBarFill, 
                    { 
                      width: `${item.accuracy}%`, 
                      backgroundColor: barColor 
                    }
                  ]} 
                />
              </View>
              <Text style={styles.statusLabel}>{statusText}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 18,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 4,
  },
  summaryValue: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
  },
  summaryAccuracy: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  chartContainer: {
    marginTop: 8,
  },
  barItem: {
    marginBottom: 16,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  topicName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  topicAccuracy: {
    fontSize: 13,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#334155',
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 5,
  },
  statusLabel: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '500',
    textAlign: 'right',
  },
  emptyContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 12,
  },
  emptyText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptySubtext: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default AnalyticsChart;
