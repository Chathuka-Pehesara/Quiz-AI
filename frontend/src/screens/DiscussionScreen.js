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
  SafeAreaView
} from 'react-native';
import Animated, { FadeInLeft, Layout } from 'react-native-reanimated';
import { api } from '../services/api';

export default function DiscussionScreen({ navigation, route }) {
  const { questionId, questionText, quizId } = route.params;
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const flatListRef = useRef(null);

  useEffect(() => {
    loadComments();
  }, [questionId]);

  const loadComments = async () => {
    try {
      setLoading(true);
      const data = await api.getComments(questionId);
      setComments(data.comments || []);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!commentText.trim()) return;
    try {
      setSubmitting(true);
      const newComment = await api.postComment(questionId, commentText.trim(), quizId);
      
      // Update local comments list
      setComments(prev => {
        // Find if we already had comments or if it's new
        const updated = [...prev, newComment];
        // Sort: pinned first, upvotes descending, then newest
        return updated.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          const upvotesA = a.upvotes ? a.upvotes.length : 0;
          const upvotesB = b.upvotes ? b.upvotes.length : 0;
          if (upvotesA !== upvotesB) return upvotesB - upvotesA;
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      });
      
      setCommentText('');
      // Scroll to bottom after a delay to allow list update
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 300);
    } catch (err) {
      console.error('Failed to post comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleUpvote = async (commentId) => {
    try {
      const updatedComment = await api.toggleUpvoteComment(questionId, commentId);
      setComments(prev => prev.map(c => {
        if (c._id === commentId) {
          // Keep sender populated info since API returns the raw comment schema update
          return {
            ...c,
            upvotes: updatedComment.upvotes
          };
        }
        return c;
      }));
    } catch (err) {
      console.error('Failed to toggle upvote:', err);
    }
  };

  const renderCommentItem = ({ item, index }) => {
    const isProfessor = item.sender?.role === 'professor';
    const upvotesCount = item.upvotes ? item.upvotes.length : 0;
    
    return (
      <Animated.View
        entering={FadeInLeft.delay(index * 50)}
        layout={Layout.springify()}
        style={[
          styles.commentRow,
          isProfessor && styles.professorCommentRow,
          item.isPinned && styles.pinnedCommentRow
        ]}
      >
        <View style={styles.commentHeader}>
          <View style={styles.senderInfo}>
            <View style={[styles.avatar, isProfessor && styles.professorAvatar]}>
              <Text style={styles.avatarText}>
                {item.sender?.name ? item.sender.name.substring(0, 2).toUpperCase() : '??'}
              </Text>
            </View>
            <View>
              <Text style={[styles.senderName, isProfessor && styles.professorName]}>
                {item.sender?.name || 'Anonymous'}
              </Text>
              <Text style={styles.senderRole}>
                {isProfessor ? 'Professor • ' : ''}{new Date(item.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
          
          {item.isPinned && (
            <View style={styles.pinnedBadge}>
              <Text style={styles.pinnedBadgeText}>📌 Pinned</Text>
            </View>
          )}
        </View>

        <Text style={[styles.commentText, isProfessor && styles.professorCommentText]}>
          {item.text}
        </Text>

        <View style={styles.commentFooter}>
          <TouchableOpacity
            style={styles.upvoteButton}
            onPress={() => handleToggleUpvote(item._id)}
            activeOpacity={0.7}
          >
            <Text style={styles.upvoteIcon}>👍</Text>
            <Text style={styles.upvoteCountText}>
              {upvotesCount} {upvotesCount === 1 ? 'Upvote' : 'Upvotes'}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Discussion Thread</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Question Header Card */}
        <View style={styles.questionCard}>
          <Text style={styles.questionLabel}>QUESTION</Text>
          <Text style={styles.questionText}>{questionText}</Text>
        </View>

        {/* Comments List */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>Loading comments...</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={comments}
            keyExtractor={(item) => item._id}
            renderItem={renderCommentItem}
            contentContainerStyle={styles.commentsListContainer}
            ListEmptyComponent={() => (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyEmoji}>💬</Text>
                <Text style={styles.emptyTitle}>No discussions yet</Text>
                <Text style={styles.emptyText}>Be the first to post a query or insight about this question!</Text>
              </View>
            )}
          />
        )}

        {/* Comment Input Box */}
        <View style={styles.inputContainer}>
          <TextInput
            placeholder="Ask a question or clarify details..."
            placeholderTextColor="#71717A"
            value={commentText}
            onChangeText={setCommentText}
            style={styles.textInput}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !commentText.trim() && styles.disabledSendButton]}
            onPress={handlePostComment}
            disabled={!commentText.trim() || submitting}
            activeOpacity={0.8}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendButtonText}>Post</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
  },
  questionCard: {
    backgroundColor: '#161618',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262629',
  },
  questionLabel: {
    color: '#818CF8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 6,
  },
  questionText: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '600',
    lineHeight: 20,
  },
  commentsListContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  commentRow: {
    backgroundColor: '#161618',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#262629',
  },
  professorCommentRow: {
    borderColor: '#6366F1' + '40', // light purple highlight
  },
  pinnedCommentRow: {
    borderColor: '#F59E0B' + '40', // light amber highlight
    backgroundColor: '#1C1917', // slightly warmer background
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#27272A',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#3F3F46',
  },
  professorAvatar: {
    backgroundColor: '#4F46E5',
    borderColor: '#6366F1',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  senderName: {
    color: '#E4E4E7',
    fontSize: 13,
    fontWeight: '700',
  },
  professorName: {
    color: '#818CF8',
  },
  senderRole: {
    color: '#71717A',
    fontSize: 10,
    marginTop: 1,
  },
  pinnedBadge: {
    backgroundColor: '#78350F',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D97706',
  },
  pinnedBadgeText: {
    color: '#FBBF24',
    fontSize: 10,
    fontWeight: '800',
  },
  commentText: {
    color: '#D4D4D8',
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 10,
  },
  professorCommentText: {
    color: '#F4F4F5',
    fontWeight: '500',
  },
  commentFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#27272A',
    paddingTop: 8,
  },
  upvoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: '#1E1E22',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2D2D33',
  },
  upvoteIcon: {
    fontSize: 12,
  },
  upvoteCountText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
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
    paddingTop: 8,
    paddingBottom: 8,
    maxHeight: 100,
    fontSize: 13.5,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    paddingVertical: 9,
    paddingHorizontal: 16,
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
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 44,
    marginBottom: 12,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 14.5,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
  },
});
