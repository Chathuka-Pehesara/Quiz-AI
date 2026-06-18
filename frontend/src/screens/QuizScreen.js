import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ActivityIndicator, Alert, ScrollView, Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';
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
  
  // Anti-cheat Telemetry States
  const [questionTimings, setQuestionTimings] = useState([]); // seconds spent per question
  const [answerSequence, setAnswerSequence] = useState([]); // answers sequence
  const [appStateChanges, setAppStateChanges] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());

  // Timing Limit States
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(10);
  const [timeLeft, setTimeLeft] = useState(null); // remaining seconds
  const [hasWarned30s, setHasWarned30s] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Offline Mode States
  const [isOffline, setIsOffline] = useState(false);
  const [cachedQuestionsList, setCachedQuestionsList] = useState([]);

  // Hints States
  const [hintsUsed, setHintsUsed] = useState([]);
  const [hintText, setHintText] = useState('');
  const [hintLoading, setHintLoading] = useState(false);

  // Wrong Answer Explanation Modal State
  const [explanationModalVisible, setExplanationModalVisible] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [explanationLoading, setExplanationLoading] = useState(false);
  const [tempWrongAnswerInfo, setTempWrongAnswerInfo] = useState(null);

  // 1. AppState Focus Tracking
  useEffect(() => {
    let appChanges = 0;
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'background' || nextState === 'inactive') {
        appChanges += 1;
        setAppStateChanges(appChanges);
        console.log(`[ANTI-CHEAT] App state changed. Count: ${appChanges}`);
      }
    });
    return () => {
      subscription.remove();
    };
  }, []);

  // 2. Connectivity Monitor & Sync
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      const connected = !!state.isConnected && !!state.isInternetReachable;
      setIsOffline(!connected);
      if (connected) {
        syncPendingSubmissions();
      }
    });
    return () => unsubscribe();
  }, []);

  const syncPendingSubmissions = async () => {
    try {
      const pending = await AsyncStorage.getItem(`pending_submission_${quizId}`);
      if (pending) {
        console.log(`[OFFLINE-SYNC] Pending submission found. Syncing...`);
        const payload = JSON.parse(pending);
        
        // Submit score
        const result = await api.submitQuizScore(
          quizId,
          payload.score,
          payload.totalQuestions,
          payload.answers,
          payload.timeTaken,
          payload.hintsUsed
        );

        // Submit anti-cheat
        try {
          await api.submitAntiCheatTelemetry(
            quizId,
            payload.timings,
            payload.answerSequence,
            payload.appStateChanges
          );
        } catch (acErr) {
          console.warn('Failed to submit anti-cheat telemetry on sync:', acErr);
        }

        await AsyncStorage.removeItem(`pending_submission_${quizId}`);
        await AsyncStorage.removeItem(`quiz_session_${quizId}`);

        Alert.alert('Connection Restored', 'Your offline quiz attempt was successfully submitted and synced!');
        
        navigation.replace('Result', {
          score: payload.score,
          total: payload.totalQuestions,
          percentage: Math.round((payload.score / payload.totalQuestions) * 100),
          quizId,
          xpEarned: result.xpEarned || 0,
          totalXp: result.totalXp,
          level: result.level,
          levelUp: result.levelUp,
          streak: result.streak,
          freezeTokens: result.freezeTokens,
          streakProtected: result.streakProtected,
          badgesUnlocked: result.badgesUnlocked || []
        });
      }
    } catch (err) {
      console.error('Error during offline sync:', err);
    }
  };

  // 3. Quiz Session & Offline Cache Initializer
  useEffect(() => {
    const initQuiz = async () => {
      try {
        const quizData = await api.getQuizDetails(quizId);
        const limitMinutes = quizData.timeLimit || 10;
        setTimeLimitMinutes(limitMinutes);
        setCachedQuestionsList(quizData.questions || []);
        await AsyncStorage.setItem(`quiz_questions_${quizId}`, JSON.stringify(quizData.questions || []));

        const savedSessionJson = await AsyncStorage.getItem(`quiz_session_${quizId}`);
        if (savedSessionJson) {
          const session = JSON.parse(savedSessionJson);
          const elapsedTime = (Date.now() - session.startTime) / 1000;
          const duration = limitMinutes * 60;
          
          if (elapsedTime >= duration) {
            Alert.alert('Time Limit Exceeded', 'Your session expired. Submitting your quiz.');
            handleSubmitQuiz(session.responses, session.startTime, true, session.hintsUsed, session.questionTimings, session.answerSequence, session.appStateChanges);
            return;
          } else {
            setResponses(session.responses || []);
            setHintsUsed(session.hintsUsed || []);
            setSessionStartTime(session.startTime);
            setQuestionTimings(session.questionTimings || []);
            setAnswerSequence(session.answerSequence || []);
            setAppStateChanges(session.appStateChanges || 0);

            const remaining = Math.max(0, Math.floor(duration - elapsedTime));
            setTimeLeft(remaining);
            setQuestionStartTime(Date.now());
            fetchNextQuestion(session.responses || [], quizData.questions || []);
          }
        } else {
          const newStartTime = Date.now();
          setSessionStartTime(newStartTime);
          setTimeLeft(limitMinutes * 60);
          
          const initialSession = {
            startTime: newStartTime,
            responses: [],
            hintsUsed: [],
            questionTimings: [],
            answerSequence: [],
            appStateChanges: 0
          };
          await AsyncStorage.setItem(`quiz_session_${quizId}`, JSON.stringify(initialSession));
          
          setQuestionStartTime(Date.now());
          fetchNextQuestion([], quizData.questions || []);
        }
      } catch (err) {
        console.warn('Offline or server error, checking local cache...', err);
        const localQs = await AsyncStorage.getItem(`quiz_questions_${quizId}`);
        const savedSessionJson = await AsyncStorage.getItem(`quiz_session_${quizId}`);
        
        if (localQs) {
          const parsedQs = JSON.parse(localQs);
          setCachedQuestionsList(parsedQs);
          setIsOffline(true);
          
          if (savedSessionJson) {
            const session = JSON.parse(savedSessionJson);
            setResponses(session.responses || []);
            setHintsUsed(session.hintsUsed || []);
            setSessionStartTime(session.startTime);
            setQuestionTimings(session.questionTimings || []);
            setAnswerSequence(session.answerSequence || []);
            setAppStateChanges(session.appStateChanges || 0);
             
            const duration = 10 * 60;
            const elapsedTime = (Date.now() - session.startTime) / 1000;
            setTimeLeft(Math.max(0, Math.floor(duration - elapsedTime)));
            fetchNextQuestion(session.responses, parsedQs);
          } else {
            const newStartTime = Date.now();
            setSessionStartTime(newStartTime);
            setTimeLeft(10 * 60);
            setQuestionStartTime(Date.now());
            fetchNextQuestion([], parsedQs);
          }
        } else {
          Alert.alert('Offline Error', 'Could not load quiz questions.');
          navigation.goBack();
        }
      }
    };

    initQuiz();
  }, []);

  // 4. Timer Countdown Ticker
  useEffect(() => {
    if (timeLeft === null) return;
    if (timeLeft <= 0) {
      Alert.alert('Time Is Up!', 'Submitting your quiz.');
      handleSubmitQuiz(responses, sessionStartTime, true, hintsUsed, questionTimings, answerSequence, appStateChanges);
      return;
    }

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        const nextVal = prev - 1;
        if (nextVal === 30 && !hasWarned30s) {
          trigger30sWarningNotification();
        }
        return nextVal;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, hasWarned30s, responses, sessionStartTime, hintsUsed, questionTimings, answerSequence, appStateChanges]);

  const trigger30sWarningNotification = async () => {
    setHasWarned30s(true);
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Quiz Time Warning! ⏳",
          body: "Only 30 seconds remaining! Submit your answers now.",
          sound: true,
        },
        trigger: null
      });
    } catch (err) {
      console.warn('Failed to schedule 30s notification:', err);
    }
    Alert.alert('Time Warning', '⏳ Only 30 seconds remaining!');
  };

  const fetchNextQuestion = async (currentResponses, loadedQs = cachedQuestionsList) => {
    setLoading(true);
    try {
      if (isOffline || loadedQs.length > 0 && cachedQuestionsList.length > 0) {
        const answeredCount = currentResponses.length;
        
        // Group questions by topic
        const topicMap = {};
        loadedQs.forEach(q => {
          if (!q.topic) return;
          const t = q.topic.trim();
          if (!topicMap[t]) topicMap[t] = [];
          topicMap[t].push(q);
        });
        
        const topicsList = Object.keys(topicMap);
        
        if (answeredCount >= topicsList.length || answeredCount >= loadedQs.length) {
          handleSubmitQuiz(currentResponses, sessionStartTime, false, hintsUsed, questionTimings, answerSequence, appStateChanges);
          return;
        }

        const nextTopic = topicsList[answeredCount] || Object.keys(topicMap)[0];
        const topicQuestions = topicMap[nextTopic] || loadedQs;
        const chosenQuestion = topicQuestions[0] || loadedQs[answeredCount];

        setCurrentQuestion(chosenQuestion);
        setTopicIndex(answeredCount);
        setTotalTopics(topicsList.length);
        setSelectedOption('');
        setShortAnswer('');
        setHintText('');
        setHintLoading(false);
        setQuestionStartTime(Date.now());
      } else {
        const data = await api.getAdaptiveNextQuestion(quizId, currentResponses);
        if (data.completed) {
          handleSubmitQuiz(currentResponses, sessionStartTime, false, hintsUsed, questionTimings, answerSequence, appStateChanges);
        } else {
          setCurrentQuestion(data.question);
          setTopicIndex(data.topicIndex);
          setTotalTopics(data.totalTopics);
          setSelectedOption('');
          setShortAnswer('');
          setHintText('');
          setHintLoading(false);
          setQuestionStartTime(Date.now());
        }
      }
    } catch (err) {
      console.warn('Fetching next question offline fallback...', err);
      setIsOffline(true);
      const localQs = await AsyncStorage.getItem(`quiz_questions_${quizId}`);
      if (localQs) {
        const parsedQs = JSON.parse(localQs);
        setCachedQuestionsList(parsedQs);
        fetchNextQuestion(currentResponses, parsedQs);
      } else {
        Alert.alert('Error', 'Failed to retrieve next question.');
        navigation.goBack();
      }
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

    let isCorrect = false;
    if (isMcq || isTf) {
      isCorrect = answerGiven.toLowerCase() === currentQuestion.correctAnswer.toLowerCase();
    } else {
      const keywords = currentQuestion.correctAnswer.toLowerCase().split(' ');
      isCorrect = keywords.some(keyword => answerGiven.toLowerCase().includes(keyword));
    }

    const elapsedSeconds = Math.round((Date.now() - questionStartTime) / 1000);

    const currentResponse = {
      questionId: currentQuestion._id,
      topic: currentQuestion.topic,
      difficulty: currentQuestion.difficulty,
      answerGiven,
      isCorrect,
      timeSpent: elapsedSeconds
    };

    const nextResponses = [...responses, currentResponse];
    setResponses(nextResponses);

    const updatedTimings = [...questionTimings, elapsedSeconds];
    setQuestionTimings(updatedTimings);

    const updatedSequence = [...answerSequence, answerGiven];
    setAnswerSequence(updatedSequence);

    // Update AsyncStorage session state
    const updatedSession = {
      startTime: sessionStartTime,
      responses: nextResponses,
      hintsUsed: hintsUsed,
      questionTimings: updatedTimings,
      answerSequence: updatedSequence,
      appStateChanges: appStateChanges
    };
    await AsyncStorage.setItem(`quiz_session_${quizId}`, JSON.stringify(updatedSession));

    if (isCorrect) {
      Alert.alert('Correct!', 'Nice job! Processing next question.', [
        { text: 'Continue', onPress: () => fetchNextQuestion(nextResponses) }
      ]);
    } else {
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

  const handleSubmitQuiz = async (
    finalResponses, 
    sTime = sessionStartTime, 
    forceSubmit = false, 
    fHints = hintsUsed,
    fTimings = questionTimings,
    fSequence = answerSequence,
    fAppState = appStateChanges
  ) => {
    setSubmitting(true);
    try {
      const correctCount = finalResponses.filter(r => r.isCorrect).length;
      const scorePercentage = Math.round((correctCount / finalResponses.length) * 100);
      const timeTaken = Math.round((Date.now() - (sTime || Date.now())) / 1000);

      if (isOffline) {
        // Cache submission payload locally for reconnection
        const pendingSubmission = {
          score: correctCount,
          totalQuestions: finalResponses.length,
          answers: finalResponses,
          timeTaken,
          hintsUsed: fHints,
          timings: fTimings,
          answerSequence: fSequence,
          appStateChanges: fAppState
        };
        await AsyncStorage.setItem(`pending_submission_${quizId}`, JSON.stringify(pendingSubmission));
        Alert.alert('Offline Mode', 'Quiz completed! Your score has been saved locally and will auto-submit when connectivity is restored.');
        navigation.replace('StudentDashboard');
        return;
      }

      if (route.params?.duelChallenge) {
        try {
          await api.challengePeer(
            route.params.duelChallenge.challengedUsername,
            quizId,
            correctCount
          );
        } catch (duelErr) {
          console.warn('Failed to initiate duel challenge:', duelErr);
        }
      } else if (route.params?.activeDuelId) {
        try {
          await api.completeDuel(route.params.activeDuelId, correctCount);
        } catch (duelErr) {
          console.warn('Failed to complete duel challenge:', duelErr);
        }
      }

      const result = await api.submitQuizScore(
        quizId, 
        correctCount, 
        finalResponses.length, 
        finalResponses,
        timeTaken,
        fHints
      );

      // Submit anti-cheat pattern verification
      try {
        await api.submitAntiCheatTelemetry(
          quizId,
          fTimings,
          fSequence,
          fAppState
        );
      } catch (acErr) {
        console.warn('Failed to submit anti-cheat telemetry:', acErr);
      }

      await AsyncStorage.removeItem(`quiz_session_${quizId}`);
      await AsyncStorage.removeItem(`quiz_questions_${quizId}`);
      
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
      console.warn('Offline/Network submit failure, saving answers locally...', err);
      const correctCount = finalResponses.filter(r => r.isCorrect).length;
      const timeTaken = Math.round((Date.now() - (sTime || Date.now())) / 1000);
      const pendingSubmission = {
        score: correctCount,
        totalQuestions: finalResponses.length,
        answers: finalResponses,
        timeTaken,
        hintsUsed: fHints,
        timings: fTimings,
        answerSequence: fSequence,
        appStateChanges: fAppState
      };
      await AsyncStorage.setItem(`pending_submission_${quizId}`, JSON.stringify(pendingSubmission));
      Alert.alert('Submission Error', 'Failed to store score history, but your progress has been cached locally. It will auto-sync on reconnect.');
      navigation.replace('StudentDashboard');
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
      {/* Offline Status Banner */}
      {isOffline && (
        <View style={{ backgroundColor: '#B91C1C', padding: 10, borderRadius: 10, marginBottom: 16, alignItems: 'center' }}>
          <Text style={{ color: '#FEE2E2', fontSize: 13, fontWeight: 'bold' }}>⚠️ Offline Mode Active. Progress is saved locally.</Text>
        </View>
      )}

      {/* Progress & Countdown Header */}
      <View style={[styles.header, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }]}>
        <View style={{ flex: 1, marginRight: 20 }}>
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
        {timeLeft !== null && (
          <View style={{ backgroundColor: '#1E293B', borderWidth: 1, borderColor: timeLeft < 60 ? '#EF4444' : '#334155', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 }}>
            <Text style={{ color: timeLeft < 60 ? '#EF4444' : '#F8FAFC', fontWeight: 'bold', fontSize: 13 }}>
              ⏱️ {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
            </Text>
          </View>
        )}
      </View>

      {/* Question Card */}
      <View style={styles.card}>
        <View style={styles.metaRow}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Text style={styles.topicBadge}>{currentQuestion.topic}</Text>
            {currentQuestion._id && (
              <TouchableOpacity 
                style={styles.discussBadge}
                onPress={() => navigation.navigate('Discussion', {
                  questionId: currentQuestion._id,
                  questionText: currentQuestion.text,
                  quizId: quizId
                })}
              >
                <Text style={styles.discussBadgeText}>💬 Discuss</Text>
              </TouchableOpacity>
            )}
          </View>
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

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity 
                activeOpacity={0.8} 
                style={[styles.modalCloseBtn, { flex: 1 }]}
                onPress={handleCloseExplanation}
              >
                <Text style={styles.modalCloseText}>Continue</Text>
              </TouchableOpacity>
              
              {currentQuestion._id && (
                <TouchableOpacity 
                  activeOpacity={0.8} 
                  style={styles.modalDiscussBtn}
                  onPress={() => {
                    setExplanationModalVisible(false);
                    setTempWrongAnswerInfo(null);
                    navigation.navigate('Discussion', {
                      questionId: currentQuestion._id,
                      questionText: currentQuestion.text,
                      quizId: quizId
                    });
                  }}
                >
                  <Text style={styles.modalDiscussBtnText}>💬 Discuss</Text>
                </TouchableOpacity>
              )}
            </View>
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
  discussBadge: {
    backgroundColor: '#1E293B',
    borderColor: '#818CF8',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  discussBadgeText: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
  },
  modalDiscussBtn: {
    backgroundColor: '#312E81',
    borderColor: '#4338CA',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDiscussBtnText: {
    color: '#818CF8',
    fontSize: 13,
    fontWeight: '700',
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
