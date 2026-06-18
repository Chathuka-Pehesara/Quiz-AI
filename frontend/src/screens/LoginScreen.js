import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, Platform } from 'react-native';
import { api } from '../services/api';
import { storeToken, storeUser } from '../utils/storage';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);

  useEffect(() => {
    const checkBiometrics = async () => {
      let biometricAllowed = true;
      try {
        const settings = await api.getAdminSettings();
        if (settings && settings.toggles && settings.toggles.biometricLogin === false) {
          biometricAllowed = false;
        }
      } catch (err) {
        console.warn('Failed to fetch platform settings on login load:', err);
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      
      const supported = hasHardware && isEnrolled && biometricAllowed;
      setBiometricsSupported(supported);

      const isEnabled = await AsyncStorage.getItem('biometrics_enabled');
      setBiometricsEnabled(isEnabled === 'true' && biometricAllowed);

      // Auto-trigger biometrics if enabled
      if (supported && isEnabled === 'true' && biometricAllowed) {
        setTimeout(() => {
          handleBiometricLogin();
        }, 300);
      }
    };
    checkBiometrics();
  }, []);

  const handleBiometricLogin = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate with FaceID / TouchID',
        fallbackLabel: 'Use password'
      });

      if (result.success) {
        const storedToken = await AsyncStorage.getItem('auth_token');
        const storedUserJson = await AsyncStorage.getItem('auth_user');
        
        if (storedToken && storedUserJson) {
          const user = JSON.parse(storedUserJson);
          Alert.alert('Success', `Welcome back, ${user.name}! (Biometric authenticated)`);
          
          if (user.role === 'admin') {
            navigation.replace('AdminDashboard');
          } else if (user.role === 'professor') {
            navigation.replace('ProfessorDashboard');
          } else {
            navigation.replace('StudentDashboard');
          }
        } else {
          Alert.alert('Login Required', 'Please sign in with password first to register biometric login.');
        }
      }
    } catch (err) {
      console.error('Biometric auth error', err);
      Alert.alert('Biometric Error', 'Authentication failed');
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const data = await api.login(email.trim(), password);
      await storeToken(data.token);
      await storeUser(data.user);
      
      Alert.alert('Success', `Welcome back, ${data.user.name}!`);
      
      if (biometricsSupported && !biometricsEnabled) {
        Alert.alert(
          'Enable Biometrics',
          'Would you like to enable fingerprint or face unlock for faster log in?',
          [
            { 
              text: 'Cancel', 
              style: 'cancel',
              onPress: () => navigateAfterLogin(data.user)
            },
            { 
              text: 'Yes, Enable', 
              onPress: async () => {
                const authResult = await LocalAuthentication.authenticateAsync({ promptMessage: 'Verify your biometrics' });
                if (authResult.success) {
                  await AsyncStorage.setItem('biometrics_enabled', 'true');
                  setBiometricsEnabled(true);
                  Alert.alert('Enabled', 'Biometric logins registered successfully for this device.');
                }
                navigateAfterLogin(data.user);
              } 
            }
          ]
        );
      } else {
        navigateAfterLogin(data.user);
      }
    } catch (err) {
      Alert.alert('Login Failed', err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const navigateAfterLogin = (user) => {
    if (user.role === 'admin') {
      navigation.replace('AdminDashboard');
    } else if (user.role === 'professor') {
      navigation.replace('ProfessorDashboard');
    } else {
      navigation.replace('StudentDashboard');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerBox}>
        <Text style={styles.title}>Quiz<Text style={{ color: '#3B82F6' }}>AI</Text></Text>
        <Text style={styles.subtitle}>University Intelligent Adaptive Exam Suite</Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Email Address</Text>
        <TextInput
          style={styles.input}
          placeholder="yourname@university.edu"
          placeholderTextColor="#64748B"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          placeholder="••••••••••••"
          placeholderTextColor="#64748B"
          secureTextEntry
          autoCapitalize="none"
          value={password}
          onChangeText={setPassword}
        />

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <TouchableOpacity 
            activeOpacity={0.8} 
            style={[styles.button, { flex: 1, marginTop: 0 }]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.buttonText}>Sign In</Text>
            )}
          </TouchableOpacity>
          {biometricsSupported && (
            <TouchableOpacity 
              activeOpacity={0.8} 
              style={[styles.button, { width: 50, backgroundColor: '#334155', marginTop: 0, justifyContent: 'center', alignItems: 'center' }]}
              onPress={handleBiometricLogin}
            >
              <Text style={{ fontSize: 20 }}>👤</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity 
          style={styles.registerLink}
          onPress={() => navigation.navigate('Register')}
        >
          <Text style={styles.registerLinkText}>
            Don't have an account? <Text style={{ color: '#3B82F6', fontWeight: 'bold' }}>Register Here</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  headerBox: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 1,
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: '#334155',
    elevation: 4,
  },
  label: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    height: 48,
    color: '#F8FAFC',
    paddingHorizontal: 16,
    marginBottom: 20,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  button: {
    backgroundColor: '#2563EB',
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
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
  buttonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
  registerLink: {
    marginTop: 20,
    alignItems: 'center',
  },
  registerLinkText: {
    color: '#94A3B8',
    fontSize: 13,
  },
});
