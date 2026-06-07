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
