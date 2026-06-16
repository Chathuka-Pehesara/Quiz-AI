import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
  SafeAreaView
} from 'react-native';
import Animated, { FadeInUp, FadeInLeft, Layout } from 'react-native-reanimated';
import { api } from '../services/api';
import { getSocket, connectSocket } from '../services/socket';

export default function GroupDetailScreen({ navigation, route }) {
  const { groupId, groupName } = route.params;
  const [activeTab, setActiveTab] = useState('chat'); // chat, leaderboard, history
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  
  // Chat States
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  
  // Invite States
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  
  const chatFlatListRef = useRef(null);
  const socketRef = useRef(null);

  useEffect(() => {
    loadInitialData();
    
    // Clean up socket listener on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.off('group_message_received');
      }
    };
  }, [groupId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      // Get profile to identify user sender
      const profile = await api.getProfile();
      setCurrentUser(profile);

      // Get initial dashboard details
      const data = await api.getGroupDashboard(groupId);
      setDashboardData(data);
      setMessages(data.messages || []);

      // Connect and join Group Chat room
      const socket = connectSocket(profile._id, profile.name);
      socketRef.current = socket;

      socket.emit('join_group_chat', { groupId });
      
      socket.off('group_message_received'); // Prevent double binding
      socket.on('group_message_received', (newMsg) => {
        setMessages(prev => {
          // Avoid duplicates
          if (prev.some(m => m._id === newMsg._id)) return prev;
          return [...prev, newMsg];
        });
        
        // Auto scroll to bottom
        if (activeTab === 'chat') {
          setTimeout(() => {
            chatFlatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      });

    } catch (err) {
      console.error('Failed to load group dashboard:', err);
      Alert.alert('Error', 'Failed to load group dashboard data.');
    } finally {
      setLoading(false);
      // Scroll to end of chat if starting on chat tab
      setTimeout(() => {
        chatFlatListRef.current?.scrollToEnd({ animated: false });
      }, 500);
    }
  };

  const handleSendMessage = () => {
    if (!messageText.trim() || !socketRef.current || !currentUser) return;

    socketRef.current.emit('send_group_message', {
      groupId,
      senderId: currentUser._id,
      text: messageText.trim()
    });

    setMessageText('');
  };

  const handleInviteUser = async () => {
    if (!inviteUsername.trim()) return;
    try {
      setInviting(true);
      await api.inviteToGroup(groupId, inviteUsername.trim());
      Alert.alert('Success', `${inviteUsername} invited and added successfully!`);
      setInviteUsername('');
      setInviteModalVisible(false);
      
      // Reload member list/leaderboard
      const data = await api.getGroupDashboard(groupId);
      setDashboardData(data);
    } catch (err) {
      Alert.alert('Invite Failed', err.message || 'Error inviting classmate');
    } finally {
      setInviting(false);
    }
  };

  const getRankEmoji = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'Genius': return '#A855F7';
      case 'Gold': return '#F59E0B';
      case 'Silver': return '#94A3B8';
      case 'Bronze':
      default:
        return '#B45309';
    }
  };

  // RENDER: Chat Message Item
  const renderMessageItem = ({ item }) => {
    const isMe = item.sender?._id === currentUser?._id;
    
    return (
      <View style={[styles.messageRow, isMe ? styles.myMessageRow : styles.otherMessageRow]}>
        {!isMe && (
          <View style={styles.messageAvatar}>
            <Text style={styles.messageAvatarText}>
              {item.sender?.name ? item.sender.name.substring(0, 2).toUpperCase() : '??'}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.myMessageBubble : styles.otherMessageBubble]}>
          {!isMe && <Text style={styles.messageSenderName}>{item.sender?.name}</Text>}
          <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.otherMessageText]}>
            {item.text}
          </Text>
          <Text style={styles.messageTime}>
            {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  // RENDER: Leaderboard Row
  const renderLeaderboardItem = ({ item, index }) => {
    const rank = index + 1;
    const isTopThree = rank <= 3;
    
    return (
      <Animated.View
        entering={FadeInLeft.delay(index * 50)}
        layout={Layout.springify()}
        style={[styles.leaderboardRow, isTopThree && styles.topLeaderboardRow]}
      >
        <View style={styles.rankContainer}>
          <Text style={[styles.rankText, isTopThree && styles.topRankText]}>
            {getRankEmoji(rank)}
          </Text>
        </View>
        <View style={styles.memberAvatar}>
          <Text style={styles.memberAvatarText}>
            {item.name.substring(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name}</Text>
          <View style={[styles.levelBadge, { backgroundColor: getLevelColor(item.level) + '20' }]}>
            <Text style={[styles.levelText, { color: getLevelColor(item.level) }]}>{item.level}</Text>
          </View>
        </View>
        <View style={styles.memberXpContainer}>
          <Text style={styles.memberXpText}>{item.xp} XP</Text>
        </View>
      </Animated.View>
    );
  };

  // RENDER: History Feed Row
  const renderHistoryItem = ({ item, index }) => {
    return (
      <Animated.View
        entering={FadeInUp.delay(index * 50)}
        layout={Layout.springify()}
        style={styles.historyRow}
      >
        <View style={styles.historyIconContainer}>
          <Text style={styles.historyIcon}>📝</Text>
        </View>
        <View style={styles.historyInfo}>
          <Text style={styles.historyTitle}>{item.quizTitle}</Text>
          <Text style={styles.historySubtitle}>
            Completed by <Text style={styles.historyStudentName}>{item.student?.name || 'Someone'}</Text>
          </Text>
          <Text style={styles.historyTime}>
            {new Date(item.completedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
        <View style={styles.historyScoreContainer}>
          <Text style={styles.historyScoreText}>
            {item.score}/{item.totalQuestions}
          </Text>
          <Text style={styles.historyPercentageText}>
            {Math.round((item.score / item.totalQuestions) * 100)}%
          </Text>
        </View>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Synchronizing group workspace...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
        <TouchableOpacity style={styles.inviteBtn} onPress={() => setInviteModalVisible(true)}>
          <Text style={styles.inviteBtnText}>➕ Invite</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'chat' && styles.activeTabButton]}
          onPress={() => setActiveTab('chat')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'chat' && styles.activeTabButtonText]}>Chat</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'leaderboard' && styles.activeTabButton]}
          onPress={() => setActiveTab('leaderboard')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'leaderboard' && styles.activeTabButtonText]}>Leaderboard</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'history' && styles.activeTabButton]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'history' && styles.activeTabButtonText]}>Activity</Text>
        </TouchableOpacity>
      </View>

      {/* Main Tab Views */}
      <View style={{ flex: 1 }}>
        {activeTab === 'chat' && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
          >
            <FlatList
              ref={chatFlatListRef}
              data={messages}
              keyExtractor={(item) => item._id}
              renderItem={renderMessageItem}
              contentContainerStyle={styles.chatListContainer}
              onContentSizeChange={() => chatFlatListRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={() => (
                <View style={styles.emptyTabContainer}>
                  <Text style={styles.emptyEmoji}>💬</Text>
                  <Text style={styles.emptyTitle}>Chat Lobby</Text>
                  <Text style={styles.emptyText}>Send a message to your teammates and start planning!</Text>
                </View>
              )}
            />
            <View style={styles.inputContainer}>
              <TextInput
                placeholder="Type a group message..."
                placeholderTextColor="#71717A"
                value={messageText}
                onChangeText={setMessageText}
                style={styles.textInput}
                onSubmitEditing={handleSendMessage}
              />
              <TouchableOpacity
                style={[styles.sendButton, !messageText.trim() && styles.disabledSendButton]}
                onPress={handleSendMessage}
                disabled={!messageText.trim()}
              >
                <Text style={styles.sendButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}

        {activeTab === 'leaderboard' && (
          <FlatList
            data={dashboardData?.leaderboard || []}
            keyExtractor={(item) => item._id}
            renderItem={renderLeaderboardItem}
            contentContainerStyle={styles.tabListContainer}
            ListEmptyComponent={() => (
              <View style={styles.emptyTabContainer}>
                <Text style={styles.emptyEmoji}>🏆</Text>
                <Text style={styles.emptyTitle}>No Members Yet</Text>
              </View>
            )}
          />
        )}

        {activeTab === 'history' && (
          <FlatList
            data={dashboardData?.quizHistory || []}
            keyExtractor={(item, index) => index.toString()}
            renderItem={renderHistoryItem}
            contentContainerStyle={styles.tabListContainer}
            ListEmptyComponent={() => (
              <View style={styles.emptyTabContainer}>
                <Text style={styles.emptyEmoji}>📝</Text>
                <Text style={styles.emptyTitle}>No Group Activity</Text>
                <Text style={styles.emptyText}>When members complete quizzes, their scores will highlight this feed.</Text>
              </View>
            )}
          />
        )}
      </View>

      {/* Invite Member Modal */}
      <Modal
        visible={inviteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setInviteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContent} entering={FadeInUp}>
            <Text style={styles.modalTitle}>Invite Classmate</Text>
            <Text style={styles.modalDescription}>Enter your peer's exact username to invite them to this study group.</Text>
            
            <TextInput
              placeholder="e.g. John Doe"
              placeholderTextColor="#71717A"
              value={inviteUsername}
              onChangeText={setInviteUsername}
              style={styles.modalTextInput}
              autoCapitalize="none"
              maxLength={30}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setInviteUsername('');
                  setInviteModalVisible(false);
                }}
                disabled={inviting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalInviteBtn, !inviteUsername.trim() && styles.disabledInviteBtn]}
                onPress={handleInviteUser}
                disabled={!inviteUsername.trim() || inviting}
              >
                {inviting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalInviteText}>Add Peer</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    paddingTop: Platform.OS === 'android' ? 36 : 0,
  },
  center: {
    flex: 1,
    backgroundColor: '#0C0C0E',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#71717A',
    fontSize: 13,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1E',
  },
  backBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#161618',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262629',
  },
  backBtnText: {
    color: '#E4E4E7',
    fontSize: 12,
    fontWeight: '600',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  inviteBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E1B4B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#312E81',
  },
  inviteBtnText: {
    color: '#818CF8',
    fontSize: 12,
    fontWeight: '700',
  },
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1E',
    backgroundColor: '#0E0E11',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabButton: {
    borderBottomColor: '#4F46E5',
  },
  tabButtonText: {
    color: '#71717A',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  chatListContainer: {
    padding: 16,
    paddingBottom: 24,
  },
  tabListContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  messageRow: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'flex-end',
    gap: 8,
  },
  myMessageRow: {
    justifyContent: 'flex-end',
  },
  otherMessageRow: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  messageAvatarText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  messageBubble: {
    maxWidth: '78%',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  myMessageBubble: {
    backgroundColor: '#4F46E5',
    borderBottomRightRadius: 2,
  },
  otherMessageBubble: {
    backgroundColor: '#161618',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#262629',
  },
  messageSenderName: {
    color: '#818CF8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 3,
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  myMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#D4D4D8',
  },
  messageTime: {
    alignSelf: 'flex-end',
    color: '#94A3B8' + '80',
    fontSize: 9,
    marginTop: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1A1A1E',
    backgroundColor: '#0E0E11',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#161618',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262629',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 13.5,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledSendButton: {
    backgroundColor: '#1C1A2E',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#262629',
  },
  topLeaderboardRow: {
    borderColor: '#4F46E5' + '40',
  },
  rankContainer: {
    width: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    color: '#71717A',
    fontSize: 13.5,
    fontWeight: '700',
  },
  topRankText: {
    fontSize: 16,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  memberAvatarText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    color: '#E4E4E7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  levelBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 1,
    paddingHorizontal: 5,
    borderRadius: 4,
  },
  levelText: {
    fontSize: 9,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  memberXpContainer: {
    justifyContent: 'center',
  },
  memberXpText: {
    color: '#10B981',
    fontSize: 13.5,
    fontWeight: '800',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161618',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#262629',
  },
  historyIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D33',
    marginRight: 12,
  },
  historyIcon: {
    fontSize: 16,
  },
  historyInfo: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
  historySubtitle: {
    color: '#A1A1AA',
    fontSize: 11.5,
  },
  historyStudentName: {
    color: '#818CF8',
    fontWeight: '600',
  },
  historyTime: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  historyScoreContainer: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  historyScoreText: {
    color: '#E4E4E7',
    fontSize: 14,
    fontWeight: '800',
  },
  historyPercentageText: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 2,
  },
  emptyTabContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#161618',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#262629',
    gap: 14,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  modalDescription: {
    color: '#A1A1AA',
    fontSize: 13,
    lineHeight: 18,
  },
  modalTextInput: {
    backgroundColor: '#0C0C0E',
    borderWidth: 1,
    borderColor: '#262629',
    borderRadius: 8,
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#27272A',
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCancelText: {
    color: '#E4E4E7',
    fontSize: 13.5,
    fontWeight: '700',
  },
  modalInviteBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledInviteBtn: {
    backgroundColor: '#1C1A2E',
  },
  modalInviteText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
