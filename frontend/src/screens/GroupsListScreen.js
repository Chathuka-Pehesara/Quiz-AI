import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform
} from 'react-native';
import Animated, { FadeInDown, Layout } from 'react-native-reanimated';
import { api } from '../services/api';

export default function GroupsListScreen({ navigation }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      setLoading(true);
      const data = await api.getMyGroups();
      setGroups(data || []);
    } catch (err) {
      console.error('Failed to load study groups:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      setCreating(true);
      const newGroup = await api.createGroup(newGroupName.trim());
      setNewGroupName('');
      setCreateModalVisible(false);
      // Reload groups list
      await loadGroups();
      // Navigate straight to the detail screen of the newly created group
      navigation.navigate('GroupDetail', { groupId: newGroup._id, groupName: newGroup.name });
    } catch (err) {
      console.error('Failed to create group:', err);
    } finally {
      setCreating(false);
    }
  };

  const renderGroupItem = ({ item, index }) => {
    const memberCount = item.members ? item.members.length : 0;
    
    return (
      <Animated.View
        entering={FadeInDown.delay(index * 100)}
        layout={Layout.springify()}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.groupCard}
          onPress={() => navigation.navigate('GroupDetail', { groupId: item._id, groupName: item.name })}
        >
          <View style={styles.groupCardHeader}>
            <View style={styles.groupIconContainer}>
              <Text style={styles.groupIcon}>👥</Text>
            </View>
            <View style={styles.groupInfo}>
              <Text style={styles.groupName}>{item.name}</Text>
              <Text style={styles.groupCreator}>Created by {item.createdBy?.name || 'Unknown'}</Text>
            </View>
          </View>
          
          <View style={styles.groupCardFooter}>
            <Text style={styles.memberCountText}>
              👤 {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
            <Text style={styles.actionText}>Enter Group →</Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading your study groups...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>✕ Close</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Groups</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Main List */}
      <FlatList
        data={groups}
        keyExtractor={(item) => item._id}
        renderItem={renderGroupItem}
        contentContainerStyle={styles.listContainer}
        ListHeaderComponent={() => (
          <View style={styles.listHeader}>
            <Text style={styles.subtitle}>Collaborate, share quizzes, track rankings, and chat with classmates in real time.</Text>
            <TouchableOpacity
              activeOpacity={0.8}
              style={styles.createBtn}
              onPress={() => setCreateModalVisible(true)}
            >
              <Text style={styles.createBtnText}>➕ Create Study Group</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎒</Text>
            <Text style={styles.emptyTitle}>No Study Groups Yet</Text>
            <Text style={styles.emptyText}>Create a private study group and invite your classmates to get started!</Text>
          </View>
        )}
      />

      {/* Create Group Modal */}
      <Modal
        visible={createModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContent} entering={FadeInDown}>
            <Text style={styles.modalTitle}>Create New Group</Text>
            <Text style={styles.modalDescription}>Enter a name for your study group. You can invite your peers afterwards.</Text>
            
            <TextInput
              placeholder="e.g. AI Algorithms Study Group"
              placeholderTextColor="#71717A"
              value={newGroupName}
              onChangeText={setNewGroupName}
              style={styles.textInput}
              maxLength={40}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setNewGroupName('');
                  setCreateModalVisible(false);
                }}
                disabled={creating}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalCreateBtn, !newGroupName.trim() && styles.disabledModalCreateBtn]}
                onPress={handleCreateGroup}
                disabled={!newGroupName.trim() || creating}
              >
                {creating ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalCreateText}>Create</Text>
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
  },
  listContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  listHeader: {
    marginBottom: 20,
    gap: 12,
  },
  subtitle: {
    color: '#A1A1AA',
    fontSize: 13.5,
    lineHeight: 20,
  },
  createBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#6366F1',
    marginTop: 4,
  },
  createBtnText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
  groupCard: {
    backgroundColor: '#161618',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#262629',
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  groupIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1E1E22',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2D2D33',
  },
  groupIcon: {
    fontSize: 18,
  },
  groupInfo: {
    flex: 1,
    gap: 3,
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  groupCreator: {
    color: '#71717A',
    fontSize: 11.5,
  },
  groupCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#262629',
    paddingTop: 12,
  },
  memberCountText: {
    color: '#A1A1AA',
    fontSize: 12.5,
    fontWeight: '600',
  },
  actionText: {
    color: '#818CF8',
    fontSize: 12.5,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 14,
  },
  emptyTitle: {
    color: '#E4E4E7',
    fontSize: 15.5,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyText: {
    color: '#71717A',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
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
  textInput: {
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
  modalCreateBtn: {
    flex: 1,
    backgroundColor: '#4F46E5',
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledModalCreateBtn: {
    backgroundColor: '#1C1A2E',
  },
  modalCreateText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '700',
  },
});
