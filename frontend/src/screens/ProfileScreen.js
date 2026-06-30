import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api, getMediaUrl } from '../services/api';
import { storeUser } from '../utils/storage';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function ProfileScreen({ navigation }) {
  const { colors, theme } = useTheme();
  const styles = getStyles(colors, theme);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [securePassword, setSecurePassword] = useState(true);

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      const profile = await api.getProfile();
      setUser(profile);
      setName(profile.name || '');
      setEmail(profile.email || '');
      setProfileImage(profile.profileImage || '');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to load user profile');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    // Request media library permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Media library access is required to upload profile pictures.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const selectedUri = result.assets[0].uri;
        setUploading(true);

        // Prepare FormData
        const formData = new FormData();
        const filename = selectedUri.split('/').pop() || 'profile.jpg';
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('image', {
          uri: Platform.OS === 'web' ? selectedUri : selectedUri,
          name: filename,
          type,
        });

        const uploadRes = await api.uploadProfileImage(formData);
        setProfileImage(uploadRes.url);
        Alert.alert('Success', 'Profile picture uploaded successfully!');
      }
    } catch (err) {
      console.error('Upload profile image error:', err);
      Alert.alert('Upload Failed', err.message || 'Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !email.trim()) {
      Alert.alert('Validation Error', 'Full Name and Email Address cannot be empty.');
      return;
    }

    setSaving(true);
    try {
      const updates = {
        name: name.trim(),
        email: email.trim(),
        profileImage,
      };
      if (password.trim()) {
        updates.password = password;
      }

      const updatedUser = await api.updateProfile(updates);
      await storeUser(updatedUser);
      setUser(updatedUser);
      setPassword('');
      Alert.alert('Success', 'Profile updated successfully!');
      navigation.goBack();
    } catch (err) {
      console.error(err);
      Alert.alert('Update Failed', err.message || 'Could not update profile details');
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (userName) => {
    if (!userName) return 'U';
    return userName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isStudent = user?.role === 'student';

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardContainer}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Row */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Profile Card Container */}
        <View style={styles.profileCard}>
          {/* Avatar Section */}
          <View style={styles.avatarSection}>
            <View style={styles.avatarOuter}>
              {profileImage ? (
                <Image
                  source={{ uri: getMediaUrl(profileImage) }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>{getInitials(name)}</Text>
                </View>
              )}
              {uploading && (
                <View style={styles.uploadLoader}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              )}
              <TouchableOpacity style={styles.editBadge} onPress={handlePickImage}>
                <Ionicons name="camera" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
            <Text style={styles.roleLabel}>{user?.role?.toUpperCase()}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.form}>
            <Text style={styles.inputLabel}>Full Name</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Jane Doe"
                placeholderTextColor={colors.textMuted}
              />
            </View>

            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="mail-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="jane@university.edu"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
              />
            </View>

            <Text style={styles.inputLabel}>New Password (Optional)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter new password"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={securePassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setSecurePassword(!securePassword)}>
                <Ionicons
                  name={securePassword ? 'eye-off-outline' : 'eye-outline'}
                  size={18}
                  color={colors.textMuted}
                />
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>Leave empty to keep your current password</Text>
          </View>
        </View>

        {/* Gamified Achievements Summary (Only for Students) */}
        {isStudent && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Level & Status</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Ionicons name="sparkles" size={20} color={colors.primary} />
                <Text style={styles.statValue}>{user?.level || 'Bronze'}</Text>
                <Text style={styles.statLabel}>Level Tier</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="flame" size={20} color={colors.coral} />
                <Text style={styles.statValue}>{user?.streak || 0} Days</Text>
                <Text style={styles.statLabel}>Active Streak</Text>
              </View>
              <View style={styles.statBox}>
                <Ionicons name="trophy" size={20} color={colors.amber} />
                <Text style={styles.statValue}>{user?.xp || 0} XP</Text>
                <Text style={styles.statLabel}>Total Points</Text>
              </View>
            </View>

            {/* Badges Section */}
            {user?.badges && user.badges.length > 0 && (
              <View style={styles.badgesWrapper}>
                <Text style={styles.badgesTitle}>Earned Badges</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.badgeScroll}>
                  {user.badges.map((badge, idx) => (
                    <View key={idx} style={styles.badgeItem}>
                      <View style={styles.badgeIconContainer}>
                        <Text style={styles.badgeEmoji}>{badge.icon || '🏅'}</Text>
                      </View>
                      <Text style={styles.badgeName} numberOfLines={1}>{badge.name}</Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        )}

        {/* Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving || uploading}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => navigation.goBack()}
            disabled={saving || uploading}
          >
            <Text style={styles.cancelBtnText}>Discard Changes</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const getStyles = (colors, theme) => {
  const isDark = theme === 'dark';

  return StyleSheet.create({
    keyboardContainer: {
      flex: 1,
      backgroundColor: colors.background,
    },
    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    container: {
      flex: 1,
    },
    contentContainer: {
      paddingBottom: 40,
      paddingHorizontal: 20,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 20,
      marginTop: Platform.OS === 'ios' ? 10 : 0,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    profileCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 24,
      alignItems: 'center',
      marginBottom: 20,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.3 : 0.05,
      shadowRadius: 12,
      elevation: 4,
    },
    avatarSection: {
      alignItems: 'center',
      marginBottom: 24,
    },
    avatarOuter: {
      width: 110,
      height: 110,
      borderRadius: 55,
      borderWidth: 3,
      borderColor: colors.primary,
      padding: 4,
      position: 'relative',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarImg: {
      width: '100%',
      height: '100%',
      borderRadius: 50,
    },
    avatarPlaceholder: {
      width: '100%',
      height: '100%',
      borderRadius: 50,
      backgroundColor: colors.primary + '15',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitials: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.primary,
    },
    editBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      backgroundColor: colors.primary,
      width: 32,
      height: 32,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    uploadLoader: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderRadius: 55,
      justifyContent: 'center',
      alignItems: 'center',
    },
    roleLabel: {
      fontSize: 11,
      fontWeight: 'bold',
      color: colors.primary,
      backgroundColor: colors.primary + '15',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 12,
      letterSpacing: 1,
    },
    form: {
      width: '100%',
    },
    inputLabel: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      height: 48,
      marginBottom: 14,
    },
    inputIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      color: colors.text,
      fontSize: 15,
      height: '100%',
    },
    helperText: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: -8,
      marginBottom: 14,
      marginLeft: 4,
    },
    statsCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    statBox: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      marginHorizontal: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 8,
    },
    statLabel: {
      fontSize: 10,
      color: colors.textMuted,
      marginTop: 2,
    },
    badgesWrapper: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 16,
    },
    badgesTitle: {
      fontSize: 13,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    badgeScroll: {
      flexDirection: 'row',
    },
    badgeItem: {
      alignItems: 'center',
      marginRight: 16,
      width: 70,
    },
    badgeIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    badgeEmoji: {
      fontSize: 22,
    },
    badgeName: {
      fontSize: 10,
      color: colors.text,
      textAlign: 'center',
    },
    actionsContainer: {
      gap: 12,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.4 : 0.2,
      shadowRadius: 8,
      elevation: 4,
    },
    saveBtnText: {
      color: '#FFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    cancelBtn: {
      height: 48,
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    cancelBtnText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '600',
    },
  });
};
