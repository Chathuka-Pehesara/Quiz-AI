import { Platform, NativeModules } from 'react-native';
import { getToken } from '../utils/storage';

// Helper to extract the local host IP dynamically from Metro Bundler's script URL.
// This allows physical devices (connected via same Wi-Fi) to reach the server automatically.
const getMetroHost = () => {
  try {
    const scriptURL = NativeModules.SourceCode?.scriptURL;
    if (scriptURL) {
      // e.g. "http://10.188.179.4:8081/index.bundle?platform=android..."
      const host = scriptURL.split('://')[1]?.split('/')[0]?.split(':')[0];
      // Check if it looks like a local network IP address
      if (host && (host.startsWith('192.') || host.startsWith('10.') || host.startsWith('172.'))) {
        return host;
      }
    }
  } catch (e) {
    console.warn('Could not dynamically resolve host IP:', e);
  }
  return null;
};

const hostIP = getMetroHost() || '10.188.179.4'; // Fallback to your host's local Wi-Fi IP address

const BASE_URL = Platform.OS === 'web'
  ? 'http://localhost:5000/api'
  : `http://${hostIP}:5000/api`;

async function request(endpoint, options = {}) {
  const token = await getToken();
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }

  // Allow connecting to localhost in non-emulator, or fallback
  let url = `${BASE_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, config);
    
    // Check if unauthorized, handles logging out
    if (response.status === 401) {
      // Clean auth tokens inside callers or redirect
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Network response was not ok');
    }
    return data;
  } catch (error) {
    console.error(`API Request failed for ${endpoint}:`, error.message);
    // Try to fallback to localhost if the resolved host IP fails (e.g. running on web or iOS or custom proxy)
    if (url.includes(hostIP)) {
      const fallbackUrl = url.replace(hostIP, 'localhost');
      try {
        const response = await fetch(fallbackUrl, config);
        const data = await response.json();
        if (!response.ok) throw new Error(data.message);
        return data;
      } catch (innerError) {
        throw new Error(innerError.message || 'API request failed');
      }
    }
    throw error;
  }
}

export const api = {
  // Authentication
  login: (email, password) => 
    request('/auth/login', { method: 'POST', body: { email, password } }),
  
  register: (name, email, password, role) => 
    request('/auth/register', { method: 'POST', body: { name, email, password, role } }),
  
  getProfile: () => 
    request('/auth/me', { method: 'GET' }),

  // Courses
  createCourse: (name, code) => 
    request('/courses', { method: 'POST', body: { name, code } }),
  
  getAllCourses: () => 
    request('/courses', { method: 'GET' }),
  
  getMyCourses: () => 
    request('/courses/my', { method: 'GET' }),
  
  enrollCourse: (code) => 
    request('/courses/enroll', { method: 'POST', body: { code } }),

  // Quizzes
  generateQuiz: (title, courseId, textInput, numQuestions) => 
    request('/quizzes/generate', { method: 'POST', body: { title, courseId, textInput, numQuestions } }),
  
  getQuizDetails: (quizId) => 
    request(`/quizzes/${quizId}`, { method: 'GET' }),
  
  updateQuiz: (quizId, title, questions) => 
    request(`/quizzes/${quizId}`, { method: 'PUT', body: { title, questions } }),
  
  publishQuiz: (quizId) => 
    request(`/quizzes/${quizId}/publish`, { method: 'PATCH' }),
  
  getCourseQuizzes: (courseId) => 
    request(`/quizzes/course/${courseId}`, { method: 'GET' }),
  
  submitQuizScore: (quizId, score, totalQuestions, answers) => 
    request(`/quizzes/${quizId}/submit`, { method: 'POST', body: { score, totalQuestions, answers } }),
  
  getAdaptiveNextQuestion: (quizId, answers) => 
    request(`/quizzes/${quizId}/adaptive-next`, { method: 'POST', body: { answers } }),
  
  explainWrongAnswer: (questionText, correctAnswer, studentAnswer) => 
    request('/quizzes/explain-wrong', { method: 'POST', body: { questionText, correctAnswer, studentAnswer } }),

  // Analytics
  getStudentKnowledgeGap: () => 
    request('/analytics/student/knowledge-gap', { method: 'GET' }),
  
  getStudentDashboard: () =>
    request('/analytics/student/dashboard', { method: 'GET' }),
  
  generatePracticeQuiz: (topic, courseId) =>
    request('/quizzes/practice-weak', { method: 'POST', body: { topic, courseId } }),

  getProfessorCourseAnalytics: (courseId) => 
    request(`/analytics/course/${courseId}`, { method: 'GET' }),

  // Admin Portal Management
  getAdminOverview: () => 
    request('/admin/overview', { method: 'GET' }),
  
  getAdminQuizzes: () => 
    request('/admin/quizzes', { method: 'GET' }),
  
  deleteAdminQuiz: (id) => 
    request(`/admin/quizzes/${id}`, { method: 'DELETE' }),
  
  getAdminUsers: (search = '', role = '', flagged = '') => 
    request(`/admin/users?search=${encodeURIComponent(search)}&role=${role}&flagged=${flagged}`, { method: 'GET' }),
  
  createAdminUser: (data) => 
    request('/admin/users', { method: 'POST', body: data }),
  
  updateAdminUser: (id, data) => 
    request(`/admin/users/${id}`, { method: 'PUT', body: data }),
  
  deleteAdminUser: (id) => 
    request(`/admin/users/${id}`, { method: 'DELETE' }),
  
  getAdminCourses: () => 
    request('/admin/courses', { method: 'GET' }),
  
  createAdminCourse: (data) => 
    request('/admin/courses', { method: 'POST', body: data }),
  
  deleteAdminCourse: (id) => 
    request(`/admin/courses/${id}`, { method: 'DELETE' }),
  
  getAdminSettings: () => 
    request('/admin/settings', { method: 'GET' }),
  
  updateAdminSettings: (data) => 
    request('/admin/settings', { method: 'PUT', body: data })
};
