import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView, Platform } from 'react-native';
import { api } from '../services/api';

export default function QuizScreen({ route, navigation }) {
  const { quizId } = route.params;
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [topicIndex, setTopicIndex] = useState(0);
  const [totalTopics, setTotalTopics] = useState(1);

  // Student Responses Cache
  const [responses, setResponses] = useState([]); // Array of { questionId, topic, difficulty, answerGiven, isCorrect }
  const [selectedOption, setSelectedOption] = useState('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [startTime, setStartTime] = useState(Date.now());

  // Hints States
  const [hintsUsed, setHintsUsed] = useState([]);
  const [hintText, setHintText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  // Wrong Answer Explanation Modal State
  const [explanationModalVisible, setExplanationModalVisible] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [tempWrongAnswerInfo, setTempWrongAnswerInfo] = useState(null);

  useEffect(() => {
    setStartTime(Date.now());
    fetchNextQuestion([]);
  }, []);

  const fetchNextQuestion = async (currentResponses) => {
    setLoading(true);
    try {
      const data = await api.getAdaptiveNextQuestion(quizId, currentResponses);
      if (data.completed) {
        // Quiz is finished! Calculate score and submit
        handleSubmitQuiz(currentResponses);
      } else {
        setCurrentQuestion(data.question);
        setTopicIndex(data.topicIndex);
        setTotalTopics(data.totalTopics);
        setSelectedOption('');
        setShortAnswer('');
        setHintText('');
        setHintLoading(false);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to retrieve next adaptive question');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerSubmit = async () => {
    const isMcq = currentQuestion.type === 'mcq';
    const isTf = currentQuestion.type === 'tf';
    
    let answerGiven = '';
    if (isMcq) answerGiven = selectedOption;
    else if (isTf) answerGiven = selectedOption;
    else answerGiven = shortAnswer.trim();

    if (!answerGiven) {
      Alert.alert('Input Needed', 'Please provide an answer before submitting.');
      return;
    }

    // Evaluate answer correctness
    let isCorrect = false;
    if (isMcq || isTf) {
      isCorrect = answerGiven.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
    } else {
      // Short answer keyword match helper
      const keywords = currentQuestion.correctAnswer.toLowerCase().split(' ');
      isCorrect = keywords.some(keyword => answerGiven.toLowerCase().includes(keyword));
    }

    const currentResponse = {
      questionId: currentQuestion._id,
      topic: currentQuestion.topic,
      difficulty: currentQuestion.difficulty,
      answerGiven,
      isCorrect
    };

    const nextResponses = [...responses, currentResponse];
    setResponses(nextResponses);

    if (isCorrect) {
      // Correct answer micro-celebration: Fetch next question immediately
      Alert.alert('Correct!', 'Nice job! Processing next question.', [
        { text: 'Continue', onPress: () => fetchNextQuestion(nextResponses) }
      ]);
    } else {
      // Wrong answer: Request Claude explanation
      setTempWrongAnswerInfo({ nextResponses, currentResponse });
      fetchExplanation(currentQuestion.text, currentQuestion.correctAnswer, answerGiven);
    }
  };

  const fetchExplanation = async (qText, correctAns, studentAns) => {
    setExplanationModalVisible(true);
    setExplanationLoading(true);
    try {
      const data = await api.explainWrongAnswer(qText, correctAns, studentAns);
      setExplanationText(data.explanation);
    } catch (err) {
      setExplanationText(`The correct answer is "${correctAns}". Double check your notes and study materials regarding this topic.`);
    } finally {
      setExplanationLoading(false);
    }
  };

  const handleGetHint = async () => {
    if (hintText || hintLoading) return;
    
    setHintLoading(true);
    try {
      const data = await api.generateHint(currentQuestion.text);
      setHintText(data.hint);
      
      if (currentQuestion._id && !hintsUsed.includes(currentQuestion._id.toString())) {
        setHintsUsed(prev => [...prev, currentQuestion._id.toString()]);
      }
    } catch (err) {
      console.error(err);
      setHintText('Try breaking down the question and focusing on the core keywords.');
    } finally {
      setHintLoading(false);
    }
  };

  const handleCloseExplanation = () => {
    setExplanationModalVisible(false);
    setExplanationText('');
    if (tempWrongAnswerInfo) {
      fetchNextQuestion(tempWrongAnswerInfo.nextResponses);
      setTempWrongAnswerInfo(null);
    }
  };

  const handleSubmitQuiz = async (finalResponses) => {
    setSubmitting(true);
    try {
      const correctCount = finalResponses.filter(r => r.isCorrect).length;
      const scorePercentage = Math.round((correctCount / finalResponses.length) * 100);
      const timeTaken = Math.round((Date.now() - startTime) / 1000);

      const result = await api.submitQuizScore(
        quizId, 
        correctCount, 
        finalResponses.length, 
        finalResponses,
        timeTaken,
        hintsUsed
      );
      
      // Navigate to Results page with gamification results
      navigation.replace('Result', {
        score: correctCount,
        total: finalResponses.length,
        percentage: scorePercentage,
        quizId,
        xpEarned: result.xpEarned,
        totalXp: result.totalXp,
        level: result.level,
        levelUp: result.levelUp,
        streak: result.streak,
        freezeTokens: result.freezeTokens,
        streakProtected: result.streakProtected,
        badgesUnlocked: result.badgesUnlocked || []
      });
    } catch (err) {
      Alert.alert('Submission Error', 'Failed to store score history, but you finished! Routing to results.');
      const correctCount = finalResponses.filter(r => r.isCorrect).length;
      const scorePercentage = Math.round((correctCount / finalResponses.length) * 100);
      navigation.replace('Result', {
        score: correctCount,
        total: finalResponses.length,
        percentage: scorePercentage,
        quizId,
        xpEarned: 0,
        badgesUnlocked: []
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || submitting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>
          {submitting ? 'Submitting final score...' : 'AI calibrating next adaptive question...'}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* Progress Header */}
      <View style={styles.header}>
        <Text style={styles.progressText}>Topic {topicIndex + 1} of {totalTopics}</Text>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${((topicIndex + 1) / totalTopics) * 100}%` }
            ]} 
          />
        </View>
      </View>

      {/* Question Card */}
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={styles.topicBadge}>{currentQuestion.topic}</Text>
          <Text style={[
            styles.difficultyBadge, 
            currentQuestion.difficulty === 'easy' && styles.easyDiff,
            currentQuestion.difficulty === 'medium' && styles.medDiff,
            currentQuestion.difficulty === 'hard' && styles.hardDiff
          ]}>
            {currentQuestion.difficulty}
          </Text>
        </View>
        
        <Text style={styles.questionText}>{currentQuestion.text}</Text>

        {/* Hint Nudge Trigger & Banner */}
        <View style={styles.hintContainer}>
          {hintLoading ? (
            <ActivityIndicator size="small" color="#F59E0B" style={styles.hintLoader} />
          ) : hintText ? (
            <View style={styles.hintBanner}>
              <Text style={styles.hintTextLabel}>💡 Hint:</Text>
              <Text style={styles.hintBodyText}>{hintText}</Text>
            </View>
          ) : (
            <TouchableOpacity 
              activeOpacity={0.8}
              style={styles.hintBtn}
              onPress={handleGetHint}
            >
              <Text style={styles.hintBtnText}>💡 Need a hint?</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Inputs */}
        {currentQuestion.type === 'mcq' && (
          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((opt, idx) => (
              <TouchableOpacity
                key={idx}
                activeOpacity={0.8}
                style={[
                  styles.optionBtn,
                  selectedOption === opt && styles.optionBtnActive
                ]}
                onPress={() => setSelectedOption(opt)}
              >
                <Text style={[
                  styles.optionText,
                  selectedOption === opt && styles.optionTextActive
                ]}>
                  {opt}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {currentQuestion.type === 'tf' && (
          <View style={styles.tfContainer}>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.tfBtn,
                selectedOption === 'True' && styles.tfActive
              ]}
              onPress={() => setSelectedOption('True')}
            >
              <Text style={styles.tfText}>True</Text>
            </TouchableOpacity>
            <TouchableOpacity
              activeOpacity={0.8}
              style={[
                styles.tfBtn,
                selectedOption === 'False' && styles.tfActive
              ]}
              onPress={() => setSelectedOption('False')}
            >
              <Text style={styles.tfText}>False</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentQuestion.type === 'short' && (
          <View style={styles.shortContainer}>
            <Text style={styles.shortLabel}>Type Answer Keyword/Phrase</Text>
            <TextInput
              style={styles.shortInput}
              placeholder="Your answer..."
              placeholderTextColor="#64748B"
              autoFocus
              value={shortAnswer}
              onChangeText={setShortAnswer}
            />
          </View>
        )}
      </View>

      {/* Submit Action */}
      <TouchableOpacity 
        activeOpacity={0.8} 
        style={styles.submitBtn} 
        onPress={handleAnswerSubmit}
      >
        <Text style={styles.submitBtnText}>Submit Answer</Text>
      </TouchableOpacity>

      {/* Wrong Answer Claude Explanation Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={explanationModalVisible}
        onRequestClose={handleCloseExplanation}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalEmoji}>💡</Text>
            <Text style={styles.modalTitle}>Claude AI Correction</Text>
            
            {explanationLoading ? (
              <View style={styles.modalLoader}>
                <ActivityIndicator size="small" color="#3B82F6" />
                <Text style={styles.modalLoaderText}>Claude is analyzing your answer...</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalScroll}>
                <Text style={styles.modalText}>{explanationText}</Text>
              </ScrollView>
            )}

            <TouchableOpacity 
              activeOpacity={0.8} 
              style={styles.modalCloseBtn}
              onPress={handleCloseExplanation}
            >
              <Text style={styles.modalCloseText}>Understood, Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    marginBottom: 20,
  },
  progressText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#1E293B',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 24,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  topicBadge: {
    backgroundColor: '#1E293B',
    borderColor: '#3B82F6',
    borderWidth: 1,
    color: '#3B82F6',
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    textTransform: 'uppercase',
  },
  difficultyBadge: {
    fontSize: 11,
    fontWeight: '700',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    textTransform: 'uppercase',
    borderWidth: 1,
  },
  easyDiff: { borderColor: '#10B981', color: '#10B981' },
  medDiff: { borderColor: '#F59E0B', color: '#F59E0B' },
  hardDiff: { borderColor: '#EF4444', color: '#EF4444' },
  questionText: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    marginBottom: 24,
  },
  optionsContainer: {
    gap: 12,
  },
  optionBtn: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
  },
  optionBtnActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  optionText: {
    color: '#E2E8F0',
    fontSize: 14,
    fontWeight: '600',
  },
  optionTextActive: {
    color: '#FFF',
  },
  tfContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  tfBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tfActive: {
    borderColor: '#3B82F6',
    backgroundColor: '#1E3A8A',
  },
  tfText: {
    color: '#E2E8F0',
    fontSize: 15,
    fontWeight: '700',
  },
  shortContainer: {
    marginTop: 8,
  },
  shortLabel: {
    color: '#64748B',
    fontSize: 11,
    textTransform: 'uppercase',
    fontWeight: '700',
    marginBottom: 8,
  },
  shortInput: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    color: '#F8FAFC',
    height: 48,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  submitBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  submitBtnText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 13, 22, 0.85)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderColor: '#334155',
    borderWidth: 1.5,
    elevation: 20,
  },
  modalEmoji: {
    fontSize: 40,
    marginBottom: 8,
  },
  modalTitle: {
    color: '#EF4444',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 16,
  },
  modalLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  modalLoaderText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  modalScroll: {
    maxHeight: 120,
    marginBottom: 20,
  },
  modalText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  modalCloseBtn: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    height: 44,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCloseText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  hintContainer: {
    marginVertical: 10,
    alignItems: 'flex-start',
    width: '100%',
  },
  hintLoader: {
    paddingVertical: 6,
    alignSelf: 'center',
  },
  hintBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#374151',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4B5563',
  },
  hintBtnText: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '700',
  },
  hintBanner: {
    backgroundColor: '#78350F' + '20',
    borderColor: '#D97706',
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 12,
    width: '100%',
    gap: 4,
  },
  hintTextLabel: {
    color: '#F59E0B',
    fontSize: 12.5,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hintBodyText: {
    color: '#FDE68A',
    fontSize: 13,
    lineHeight: 18,
  },
});
