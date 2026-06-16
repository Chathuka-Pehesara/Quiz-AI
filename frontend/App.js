import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { getOnboardingRole } from './src/utils/storage';

// Screens
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import StudentDashboard from './src/screens/StudentDashboard';
import ProfessorDashboard from './src/screens/ProfessorDashboard';
import AdminDashboard from './src/screens/AdminDashboard';
import CreateQuizScreen from './src/screens/CreateQuizScreen';
import QuizScreen from './src/screens/QuizScreen';
import ResultScreen from './src/screens/ResultScreen';
import BattleLobbyScreen from './src/screens/BattleLobbyScreen';
import BattleScreen from './src/screens/BattleScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import StudyPlannerScreen from './src/screens/StudyPlannerScreen';
import GroupsListScreen from './src/screens/GroupsListScreen';
import GroupDetailScreen from './src/screens/GroupDetailScreen';
import DiscussionScreen from './src/screens/DiscussionScreen';

const Stack = createStackNavigator();

// Custom Screen Transition Interpolators
const slideForwardInterpolator = ({ current, next, layouts }) => {
  return {
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width, 0],
          }),
        },
      ],
    },
  };
};

const fadeInterpolator = ({ current }) => {
  return {
    cardStyle: {
      opacity: current.progress,
    },
  };
};

function AppNavigation() {
  const { colors, theme } = useTheme();
  const [isOnboarded, setIsOnboarded] = useState(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const role = await getOnboardingRole();
      setIsOnboarded(!!role);
    };
    checkOnboarding();
  }, []);

  if (isOnboarded === null) {
    return (
      <View style={[styles.center, { backgroundColor: '#0F1117' }]}>
        <ActivityIndicator size="large" color="#534AB7" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName={isOnboarded ? "Login" : "Onboarding"}
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: colors.background },
            cardStyleInterpolator: slideForwardInterpolator,
          }}
        >
          <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ cardStyleInterpolator: fadeInterpolator }} />
          <Stack.Screen name="Login" component={LoginScreen} options={{ cardStyleInterpolator: fadeInterpolator }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          
          {/* Dashboards */}
          <Stack.Screen name="StudentDashboard" component={StudentDashboard} options={{ cardStyleInterpolator: fadeInterpolator }} />
          <Stack.Screen name="ProfessorDashboard" component={ProfessorDashboard} options={{ cardStyleInterpolator: fadeInterpolator }} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} options={{ cardStyleInterpolator: fadeInterpolator }} />
          
          {/* Quizzes */}
          <Stack.Screen name="CreateQuiz" component={CreateQuizScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="Quiz" component={QuizScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="Result" component={ResultScreen} options={{ cardStyleInterpolator: fadeInterpolator }} />
          
          {/* Battle Rooms */}
          <Stack.Screen name="BattleLobby" component={BattleLobbyScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="Battle" component={BattleScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />

          {/* Gamification & AI Planner */}
          <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="StudyPlanner" component={StudyPlannerScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />

          {/* Social & Community Screens */}
          <Stack.Screen name="GroupsList" component={GroupsListScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
          <Stack.Screen name="Discussion" component={DiscussionScreen} options={{ cardStyleInterpolator: slideForwardInterpolator }} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppNavigation />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
