import AsyncStorage from '@react-native-async-storage/async-storage';

export const storeToken = async (token) => {
  try {
    await AsyncStorage.setItem('auth_token', token);
  } catch (e) {
    console.error('Error storing auth token', e);
  }
};

export const getToken = async () => {
  try {
    return await AsyncStorage.getItem('auth_token');
  } catch (e) {
    console.error('Error fetching auth token', e);
    return null;
  }
};

export const storeUser = async (user) => {
  try {
    await AsyncStorage.setItem('auth_user', JSON.stringify(user));
  } catch (e) {
    console.error('Error storing user profile', e);
  }
};

export const getUser = async () => {
  try {
    const user = await AsyncStorage.getItem('auth_user');
    return user ? JSON.parse(user) : null;
  } catch (e) {
    console.error('Error fetching user profile', e);
    return null;
  }
};

export const cacheQuizzes = async (courseId, quizzes) => {
  try {
    await AsyncStorage.setItem(`cache_quizzes_${courseId}`, JSON.stringify(quizzes));
  } catch (e) {
    console.error('Error caching quizzes', e);
  }
};

export const getCachedQuizzes = async (courseId) => {
  try {
    const quizzes = await AsyncStorage.getItem(`cache_quizzes_${courseId}`);
    return quizzes ? JSON.parse(quizzes) : null;
  } catch (e) {
    console.error('Error fetching cached quizzes', e);
    return null;
  }
};

export const clearAuth = async () => {
  try {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('auth_user');
  } catch (e) {
    console.error('Error clearing auth storage', e);
  }
};

export const storeOnboardingRole = async (role) => {
  try {
    await AsyncStorage.setItem('onboarding_role', role);
  } catch (e) {
    console.error('Error storing onboarding role', e);
  }
};

export const getOnboardingRole = async () => {
  try {
    return await AsyncStorage.getItem('onboarding_role');
  } catch (e) {
    console.error('Error fetching onboarding role', e);
    return null;
  }
};

const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const base64Decode = (input) => {
  let str = input.replace(/=+$/, '').replace(/-/g, '+').replace(/_/g, '/');
  let output = '';
  if (str.length % 4 === 1) {
    throw new Error('Invalid base64');
  }
  for (let bc = 0, bs = 0, buffer, idx = 0; idx < str.length; idx++) {
    const char = str.charAt(idx);
    const parent = base64Chars.indexOf(char);
    if (parent === -1) continue;
    buffer = bc % 4 ? (buffer << 6) + parent : parent;
    if (bc++ % 4) {
      output += String.fromCharCode(255 & (buffer >> ((-2 * bc) & 6)));
    }
  }
  return output;
};

export const getRoleFromToken = async () => {
  try {
    const token = await AsyncStorage.getItem('auth_token');
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = parts[1];
    const raw = base64Decode(payload);
    const decoded = JSON.parse(raw);
    return decoded.role || null;
  } catch (e) {
    console.error('Failed to decode role from token', e);
    return null;
  }
};
