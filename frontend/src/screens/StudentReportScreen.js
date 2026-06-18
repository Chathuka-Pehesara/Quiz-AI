import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { api } from '../services/api';

export default function StudentReportScreen({ navigation }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);

  useEffect(() => {
    fetchReportData();
  }, []);

  const fetchReportData = async () => {
    try {
      setLoading(true);
      const data = await api.getStudentReport();
      setReport(data);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to retrieve performance report details.');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = async () => {
    if (!report) return;
    setPdfLoading(true);
    try {
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Academic Performance Report</title>
          <style>
            body {
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
              color: #1E293B;
              padding: 40px;
              background-color: #F8FAFC;
            }
            .header {
              text-align: center;
              border-bottom: 2px solid #E2E8F0;
              padding-bottom: 20px;
              margin-bottom: 30px;
            }
            .title {
              font-size: 28px;
              font-weight: 800;
              color: #2563EB;
              margin: 0;
            }
            .subtitle {
              font-size: 14px;
              color: #64748B;
              margin-top: 5px;
            }
            .student-info {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 20px;
            }
            .section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 18px;
              font-weight: 700;
              color: #1E293B;
              border-left: 4px solid #2563EB;
              padding-left: 10px;
              margin-bottom: 15px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
              margin-bottom: 20px;
            }
            .card {
              background-color: #FFFFFF;
              border: 1px solid #E2E8F0;
              border-radius: 8px;
              padding: 15px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.05);
            }
            .card-val {
              font-size: 24px;
              font-weight: 800;
              color: #2563EB;
            }
            .card-lbl {
              font-size: 12px;
              color: #64748B;
              text-transform: uppercase;
              font-weight: 600;
              margin-top: 5px;
            }
            .table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            .table th, .table td {
              border: 1px solid #E2E8F0;
              padding: 12px;
              text-align: left;
            }
            .table th {
              background-color: #F1F5F9;
              font-weight: 700;
            }
            .ai-insight {
              background-color: #EFF6FF;
              border: 1px solid #BFDBFE;
              border-radius: 8px;
              padding: 20px;
              margin-top: 20px;
              font-style: italic;
              line-height: 1.6;
            }
            .list-item {
              margin-bottom: 8px;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Academic Performance Report</h1>
            <p class="subtitle">Quiz AI Platform &bull; Student Semester Summary</p>
          </div>

          <div class="student-info">
            Student Name: <span style="color: #2563EB;">${report.studentName}</span>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-val">${report.quizzesTakenCount}</div>
              <div class="card-lbl">Quizzes Completed</div>
            </div>
            <div class="card">
              <div class="card-val">${report.level} (${report.xp} XP)</div>
              <div class="card-lbl">XP Rank</div>
            </div>
            <div class="card">
              <div class="card-val">${report.streak} Days</div>
              <div class="card-lbl">Current Streak</div>
            </div>
            <div class="card">
              <div class="card-val">${report.badges.length}</div>
              <div class="card-lbl">Badges Unlocked</div>
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">Course Overview & Grades</h2>
            <table class="table">
              <thead>
                <tr>
                  <th>Course Code</th>
                  <th>Course Name</th>
                  <th>Average Quiz Score</th>
                </tr>
              </thead>
              <tbody>
                ${report.courseAverages.map(course => `
                  <tr>
                    <td><strong>${course.code}</strong></td>
                    <td>${course.name}</td>
                    <td><span style="color: ${course.averageScore >= 80 ? '#10B981' : course.averageScore >= 50 ? '#F59E0B' : '#EF4444'}; font-weight: bold;">${course.averageScore}%</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="grid">
            <div class="card">
              <h3 style="margin-top:0; font-size:14px; color:#10B981;">Strongest Topics</h3>
              ${report.strongestTopics.map(t => `<div class="list-item">&bull; ${t}</div>`).join('') || '<div>No data available</div>'}
            </div>
            <div class="card">
              <h3 style="margin-top:0; font-size:14px; color:#EF4444;">Weakest Topics</h3>
              ${report.weakestTopics.map(t => `<div class="list-item">&bull; ${t}</div>`).join('') || '<div>No data available</div>'}
            </div>
          </div>

          <div class="section">
            <h2 class="section-title">AI Personalized Recommendation</h2>
            <div class="ai-insight">
              "${report.aiSummary}"
            </div>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'Share Semester Report' });
    } catch (err) {
      console.error(err);
      Alert.alert('Export Failed', 'Could not export performance report as PDF.');
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Compiling semester records...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 50 }}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Semester Report</Text>
      </View>

      {/* Info Card */}
      <View style={styles.profileCard}>
        <Text style={styles.studentLabel}>STUDENT PERFORMANCE REPORT</Text>
        <Text style={styles.studentName}>{report.studentName}</Text>
        <Text style={styles.studentLevel}>Level: {report.level} &bull; {report.xp} XP</Text>
      </View>

      {/* Grid Stats */}
      <View style={styles.grid}>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>{report.quizzesTakenCount}</Text>
          <Text style={styles.statLbl}>Quizzes Taken</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statVal}>🔥 {report.streak}</Text>
          <Text style={styles.statLbl}>Day Streak</Text>
        </View>
      </View>

      {/* Courses List */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Course Grades</Text>
        {report.courseAverages.length === 0 ? (
          <Text style={styles.emptyText}>Not enrolled in any classes yet.</Text>
        ) : (
          report.courseAverages.map((c, idx) => (
            <View key={idx} style={styles.courseRow}>
              <View>
                <Text style={styles.courseCode}>{c.code}</Text>
                <Text style={styles.courseName}>{c.name}</Text>
              </View>
              <Text style={[styles.courseAvg, { color: c.averageScore >= 80 ? '#10B981' : c.averageScore >= 50 ? '#F59E0B' : '#EF4444' }]}>
                {c.averageScore}%
              </Text>
            </View>
          ))
        )}
      </View>

      {/* Strengths & Weaknesses */}
      <View style={styles.topicGrid}>
        <View style={[styles.topicCard, { borderColor: '#10B981' }]}>
          <Text style={[styles.topicTitle, { color: '#10B981' }]}>Strongest Topics</Text>
          {report.strongestTopics.length === 0 ? (
            <Text style={styles.emptyText}>Not enough attempts yet.</Text>
          ) : (
            report.strongestTopics.map((t, idx) => (
              <Text key={idx} style={styles.topicText}>&bull; {t}</Text>
            ))
          )}
        </View>

        <View style={[styles.topicCard, { borderColor: '#EF4444' }]}>
          <Text style={[styles.topicTitle, { color: '#EF4444' }]}>Weakest Topics</Text>
          {report.weakestTopics.length === 0 ? (
            <Text style={styles.emptyText}>Not enough attempts yet.</Text>
          ) : (
            report.weakestTopics.map((t, idx) => (
              <Text key={idx} style={styles.topicText}>&bull; {t}</Text>
            ))
          )}
        </View>
      </View>

      {/* Badges Earned */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Badges Collected</Text>
        <Text style={styles.badgeSub}>{report.badges.length} badges earned this semester</Text>
        <View style={styles.badgeRow}>
          {report.badges.length === 0 ? (
            <Text style={styles.emptyText}>Complete quizzes to unlock badges!</Text>
          ) : (
            report.badges.map((b, idx) => (
              <View key={idx} style={styles.badgePill}>
                <Text style={styles.badgeText}>🏆 {b}</Text>
              </View>
            ))
          )}
        </View>
      </View>

      {/* AI Summary */}
      <View style={styles.insightBox}>
        <Text style={styles.insightTitle}>✨ Claude AI Study Advisor Summary</Text>
        <Text style={styles.insightText}>"{report.aiSummary}"</Text>
      </View>

      {/* PDF Export trigger */}
      <TouchableOpacity 
        style={styles.pdfBtn} 
        onPress={generatePDF}
        disabled={pdfLoading}
      >
        {pdfLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={styles.pdfBtnText}>Export Report as PDF 📄</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingTop: 40,
  },
  center: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
    height: 40,
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    position: 'absolute',
    left: 0,
    zIndex: 10,
  },
  backBtnText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    flex: 1,
  },
  profileCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  studentLabel: {
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  studentName: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '850',
    marginBottom: 4,
  },
  studentLevel: {
    color: '#94A3B8',
    fontSize: 13,
  },
  grid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statVal: {
    color: '#3B82F6',
    fontSize: 22,
    fontWeight: '900',
  },
  statLbl: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 2,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  courseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  courseCode: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '700',
  },
  courseName: {
    color: '#94A3B8',
    fontSize: 12,
  },
  courseAvg: {
    fontSize: 16,
    fontWeight: '800',
  },
  topicGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  topicCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1.5,
  },
  topicTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 8,
  },
  topicText: {
    color: '#E2E8F0',
    fontSize: 11,
    marginBottom: 4,
    lineHeight: 15,
  },
  badgeSub: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badgePill: {
    backgroundColor: '#334155',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600',
  },
  insightBox: {
    backgroundColor: '#1E3A8A' + '20',
    borderColor: '#3B82F6' + '40',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  insightTitle: {
    color: '#60A5FA',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  insightText: {
    color: '#93C5FD',
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  pdfBtn: {
    backgroundColor: '#10B981',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
  },
});
