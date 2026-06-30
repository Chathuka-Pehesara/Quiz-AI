import { useTheme } from '../context/ThemeContext';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { VictoryBar, VictoryChart, VictoryTheme, VictoryAxis, VictoryGroup, VictoryLegend } from 'victory-native';
import { api } from '../services/api';

export default function QuizAnalyticsScreen({ route, navigation }) {
  const { colors, theme } = useTheme();
  const styles = getStyles(colors, theme);
  const { quizId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchQuizAnalytics();
  }, []);

  const fetchQuizAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getQuizAnalytics(quizId);
      setData(res);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to retrieve quiz analytics details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Compiling quiz telemetry...</Text>
      </View>
    );
  }

  if (!data || data.questions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No analytics data available for this quiz yet.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Format data for Victory charts
  // Chart expects an array of objects: { x: questionLabel, y: count }
  const correctData = data.questions.map((q, idx) => ({
    x: `Q${idx + 1}`,
    y: q.correctCount
  }));

  const incorrectData = data.questions.map((q, idx) => ({
    x: `Q${idx + 1}`,
    y: q.incorrectCount
  }));

  // Determine max y value for proper chart bounds
  const maxVal = Math.max(
    ...data.questions.map(q => Math.max(q.correctCount, q.incorrectCount)),
    5 // default minimum bound
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtnHeader} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnTextHeader}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>Quiz Analytics</Text>
      </View>

      {/* Info Card */}
      <View style={styles.quizCard}>
        <Text style={styles.quizLabel}>PER-QUESTION TELEMETRY</Text>
        <Text style={styles.quizTitle}>{data.quizTitle}</Text>
        <Text style={styles.quizSub}>{data.totalSubmissions} attempts graded</Text>
      </View>

      {/* Chart Card */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>Correct vs Wrong Answers</Text>
        
        {data.totalSubmissions === 0 ? (
          <Text style={styles.emptyChartText}>No student attempts recorded yet to chart.</Text>
        ) : (
          <View style={{ alignItems: 'center', marginLeft: -20 }}>
            <VictoryChart
              theme={VictoryTheme?.material}
              domain={{ y: [0, maxVal + 1] }}
              height={220}
              width={340}
              padding={{ top: 20, bottom: 40, left: 40, right: 20 }}
            >
              <VictoryAxis
                tickFormat={x => x}
                style={{
                  tickLabels: { fill: '#94A3B8', fontSize: 10, fontWeight: 'bold' },
                  axis: { stroke: colors.border },
                  grid: { stroke: 'transparent' }
                }}
              />
              <VictoryAxis
                dependentAxis
                style={{
                  tickLabels: { fill: '#94A3B8', fontSize: 10 },
                  axis: { stroke: colors.border },
                  grid: { stroke: colors.border, strokeDasharray: '4, 4' }
                }}
              />
              <VictoryGroup offset={12} colorScale={[colors.teal, colors.coral]}>
                <VictoryBar
                  data={correctData}
                  barWidth={10}
                  cornerRadius={{ top: 4 }}
                />
                <VictoryBar
                  data={incorrectData}
                  barWidth={10}
                  cornerRadius={{ top: 4 }}
                />
              </VictoryGroup>
            </VictoryChart>

            {/* Custom Legend */}
            <View style={styles.legendContainer}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: colors.teal }]} />
                <Text style={styles.legendLabel}>Correct</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: colors.coral }]} />
                <Text style={styles.legendLabel}>Incorrect</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {/* Questions Breakdown */}
      <Text style={styles.sectionTitle}>Per-Question Details</Text>
      {data.questions.map((q, idx) => (
        <View key={q.questionId} style={styles.questionBox}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionIndex}>Question {idx + 1}</Text>
            <View style={styles.accuracyPill}>
              <Text style={styles.accuracyText}>
                {q.correctCount + q.incorrectCount > 0
                  ? Math.round((q.correctCount / (q.correctCount + q.incorrectCount)) * 100)
                  : 100}
                % Accuracy
              </Text>
            </View>
          </View>
          
          <Text style={styles.questionText}>{q.text}</Text>

          <View style={styles.divider} />

          {/* Telemetry rows */}
          <View style={styles.telemetryRow}>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryVal}>{q.correctCount}</Text>
              <Text style={styles.telemetryLbl}>Got Right</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryVal}>{q.incorrectCount}</Text>
              <Text style={styles.telemetryLbl}>Got Wrong</Text>
            </View>
            <View style={styles.telemetryItem}>
              <Text style={styles.telemetryVal}>{q.averageTime}s</Text>
              <Text style={styles.telemetryLbl}>Avg Time</Text>
            </View>
          </View>

          {q.incorrectCount > 0 && (
            <View style={styles.wrongAnswerCard}>
              <Text style={styles.wrongAnswerTitle}>⚠️ Most Common Incorrect Answer:</Text>
              <Text style={styles.wrongAnswerText}>{q.mostCommonWrongAnswer}</Text>
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const getStyles = (colors, theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 12,
  },
  errorText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    height: 40,
  },
  backBtnHeader: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
  backBtnTextHeader: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  backBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  backBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  quizCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quizLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  quizTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '850',
    marginBottom: 4,
  },
  quizSub: {
    color: colors.textMuted,
    fontSize: 12,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chartTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 10,
  },
  legendContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
    justifyContent: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 12,
  },
  questionBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  questionIndex: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  accuracyPill: {
    backgroundColor: '#1E3A8A' + '40',
    borderColor: colors.primary + '60',
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  accuracyText: {
    color: '#60A5FA',
    fontSize: 11,
    fontWeight: '700',
  },
  questionText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 12,
  },
  telemetryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  telemetryItem: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  telemetryVal: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  telemetryLbl: {
    color: colors.textMuted,
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  wrongAnswerCard: {
    marginTop: 12,
    backgroundColor: colors.coral + '10',
    borderColor: colors.coral + '30',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  wrongAnswerTitle: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '800',
  },
  wrongAnswerText: {
    color: colors.text,
    fontSize: 12,
    marginTop: 2,
  },
  emptyChartText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 20,
  },
});
