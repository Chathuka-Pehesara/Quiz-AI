import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator, Modal, FlatList, Alert } from 'react-native';
import { getSocket, disconnectSocket } from '../services/socket';

export default function BattleScreen({ route, navigation }) {
  const { roomCode, initialQuestion, initialIndex, totalQuestions, user } = route.params;

  const [question, setQuestion] = useState(initialQuestion);
  const [qIndex, setQIndex] = useState(initialIndex);
  
  const [selectedOption, setSelectedOption] = useState('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [submitted, setSubmitted] = useState(false);

  // Scoreboard / Leaderboard Modal State
  const [leaderboardVisible, setLeaderboardVisible] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [correctAnswer, setCorrectAnswer] = useState('');
  const [countdown, setCountdown] = useState(5);
  
  // Game End State
  const [battleEnded, setBattleEnded] = useState(false);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) {
      Alert.alert('Error', 'Connection to socket server lost.');
      navigation.replace('StudentDashboard');
      return;
    }

    // 1. Sockets listeners for transitions
    socket.on('question_result', ({ correctAnswer, leaderboard, currentQuestionIndex, isLastQuestion }) => {
      setCorrectAnswer(correctAnswer);
      setLeaderboardData(leaderboard);
      setLeaderboardVisible(true);
      
      // Start 5 second countdown local ticker
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });

    socket.on('next_question', ({ question, currentIndex }) => {
      // Clear inputs, close leaderboard
      setLeaderboardVisible(false);
      setQuestion(question);
      setQIndex(currentIndex);
      setSelectedOption('');
      setShortAnswer('');
      setSubmitted(false);
    });

    socket.on('battle_ended', ({ leaderboard }) => {
      setLeaderboardVisible(false);
      setLeaderboardData(leaderboard);
      setBattleEnded(true);
    });

    socket.on('error_message', (msg) => {
      Alert.alert('Game Error', msg);
    });

    return () => {
      socket.off('question_result');
      socket.off('next_question');
      socket.off('battle_ended');
      socket.off('error_message');
    };
  }, []);

  const handleAnswerSubmit = () => {
    const socket = getSocket();
    if (!socket) return;

    const isMcq = question.type === 'mcq';
    const isTf = question.type === 'tf';
    
    let answerGiven = '';
    if (isMcq) answerGiven = selectedOption;
    else if (isTf) answerGiven = selectedOption;
    else answerGiven = shortAnswer.trim();

    if (!answerGiven) {
      Alert.alert('Input Needed', 'Please enter an answer first.');
      return;
    }

    let isCorrect = false;
    if (isMcq || isTf) {
      isCorrect = answerGiven.toLowerCase() === question.correctAnswer.toLowerCase();
    } else {
      const keywords = question.correctAnswer.toLowerCase().split(' ');
      isCorrect = keywords.some(keyword => answerGiven.toLowerCase().includes(keyword));
    }

    setSubmitted(true);
    
    // Emit answer submission to Room Coordinator
    socket.emit('submit_battle_answer', {
      roomCode,
      userId: user.id,
      isCorrect,
      answer: answerGiven
    });
  };

  const handleLeaveBattle = () => {
    disconnectSocket();
    if (user.role === 'professor') {
      navigation.replace('ProfessorDashboard');
    } else {
      navigation.replace('StudentDashboard');
    }
  };

  if (battleEnded) {
    const winner = leaderboardData[0];
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Battle Finished! 🏁</Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.winnerEmoji}>👑</Text>
          <Text style={styles.winnerSub}>Quiz Champion</Text>
          <Text style={styles.winnerName}>{winner ? winner.name : 'Unknown'}</Text>
          <Text style={styles.winnerScore}>{winner ? winner.score : 0} Points</Text>

          {/* Final Standings Table */}
          <Text style={styles.tableTitle}>Final Standings</Text>
          <FlatList
            data={leaderboardData}
            keyExtractor={(item) => item.userId}
            renderItem={({ item, index }) => (
              <View style={styles.leaderboardItem}>
                <Text style={styles.rankText}>#{index + 1}</Text>
                <Text style={styles.playerText} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.scoreVal}>{item.score} pts</Text>
              </View>
            )}
          />
        </View>

        <TouchableOpacity 
          activeOpacity={0.8}
          style={styles.leaveBtn}
          onPress={handleLeaveBattle}
        >
          <Text style={styles.leaveBtnText}>Exit Battle Room</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Progress Header */}
      <View style={styles.headerRow}>
        <Text style={styles.progressText}>Question {qIndex + 1} of {totalQuestions}</Text>
        <TouchableOpacity style={styles.exitIconBtn} onPress={handleLeaveBattle}>
          <Text style={styles.exitIconText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.questionTopic}>{question.topic}</Text>
        <Text style={styles.questionText}>{question.text}</Text>

        {/* Inputs */}
        {!submitted ? (
          <View>
            {question.type === 'mcq' && (
              <View style={styles.optBox}>
                {question.options.map((opt, idx) => (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.8}
                    style={[
                      styles.optBtn,
                      selectedOption === opt && styles.optBtnActive
                    ]}
                    onPress={() => setSelectedOption(opt)}
                  >
                    <Text style={[styles.optText, selectedOption === opt && styles.optTextActive]}>{opt}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {question.type === 'tf' && (
              <View style={styles.tfBox}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.tfBtn, selectedOption === 'True' && styles.tfBtnActive]}
                  onPress={() => setSelectedOption('True')}
                >
                  <Text style={styles.tfBtnText}>True</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={[styles.tfBtn, selectedOption === 'False' && styles.tfBtnActive]}
                  onPress={() => setSelectedOption('False')}
                >
                  <Text style={styles.tfBtnText}>False</Text>
                </TouchableOpacity>
              </View>
            )}

            {question.type === 'short' && (
              <View style={styles.shortBox}>
                <TextInput
                  style={styles.shortInput}
                  placeholder="Type answer phrase..."
                  placeholderTextColor="#64748B"
                  value={shortAnswer}
                  onChangeText={setShortAnswer}
                />
              </View>
            )}

            <TouchableOpacity 
              activeOpacity={0.8}
              style={styles.submitBtn}
              onPress={handleAnswerSubmit}
            >
              <Text style={styles.submitBtnText}>Submit Response</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.waitingContainer}>
            <ActivityIndicator size="small" color="#3B82F6" />
            <Text style={styles.waitingText}>Answer locked in. Waiting for peers...</Text>
          </View>
        )}
      </View>

      {/* Live Question Standings overlay (Modal) */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={leaderboardVisible}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Round Summary</Text>
            <Text style={styles.correctLabel}>Correct Answer: <Text style={{ color: '#10B981' }}>{correctAnswer}</Text></Text>

            <Text style={styles.scoreHeader}>Live Leaderboard</Text>
            <View style={styles.listContainer}>
              {leaderboardData.map((item, idx) => (
                <View key={item.userId} style={styles.leaderboardItem}>
                  <Text style={styles.rankText}>#{idx + 1}</Text>
                  <Text style={styles.playerText} numberOfLines={1}>{item.name}</Text>
                  <Text style={styles.scoreVal}>{item.score} pts</Text>
                </View>
              ))}
            </View>

            <View style={styles.timerContainer}>
              <Text style={styles.timerText}>Next question in {countdown}s...</Text>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingHorizontal: 24,
    paddingTop: 40,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 24,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
  exitIconBtn: {
    borderColor: '#E11D48',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  exitIconText: {
    color: '#E11D48',
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderColor: '#334155',
    borderWidth: 1.5,
    elevation: 6,
    maxHeight: 460,
  },
  questionTopic: {
    color: '#3B82F6',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  questionText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 20,
  },
  optBox: {
    gap: 10,
    marginBottom: 16,
  },
  optBtn: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
  },
  optBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  optText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  optTextActive: {
    color: '#FFF',
  },
  tfBox: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  tfBtn: {
    flex: 1,
    height: 44,
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tfBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  tfBtnText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '700',
  },
  shortBox: {
    marginBottom: 16,
  },
  shortInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    color: '#F8FAFC',
    height: 44,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  waitingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  waitingText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.9)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderColor: '#334155',
    borderWidth: 1.5,
    elevation: 20,
  },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 10,
  },
  correctLabel: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  scoreHeader: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    paddingBottom: 4,
  },
  listContainer: {
    maxHeight: 200,
    gap: 6,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  rankText: {
    color: '#F59E0B',
    fontWeight: '800',
    fontSize: 13,
    width: 28,
  },
  playerText: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  scoreVal: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 13,
  },
  timerContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  timerText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '600',
  },
  winnerEmoji: {
    fontSize: 54,
    textAlign: 'center',
    marginTop: 10,
  },
  winnerSub: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    textAlign: 'center',
    letterSpacing: 1,
    marginTop: 6,
  },
  winnerName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 4,
  },
  winnerScore: {
    color: '#10B981',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  tableTitle: {
    color: '#94A3B8',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 8,
  },
  leaveBtn: {
    backgroundColor: '#E11D48',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  leaveBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
