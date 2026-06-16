import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Set up the notification handler behaviors
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Request notification permissions from the system.
 */
export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Failed to get push token for notification!');
    return false;
  }
  return true;
}

/**
 * Schedules daily reminder at most active hours, and streak warnings at 8 PM if not yet quizzed today.
 */
export async function scheduleSmartReminders(activeTimes = [], streakCount = 0, lastActiveDate = null) {
  if (Platform.OS === 'web') return;

  const hasPermission = await registerForPushNotificationsAsync();
  if (!hasPermission) return;

  // Cancel all previously scheduled reminders to prevent double notifications
  await Notifications.cancelAllScheduledNotificationsAsync();

  // 1. Calculate most active hour
  let mostActiveHour = 16; // default to 4 PM
  if (activeTimes && activeTimes.length > 0) {
    // Find the hour with highest count
    const sorted = [...activeTimes].sort((a, b) => b.count - a.count);
    mostActiveHour = sorted[0].hour;
  }

  // Schedule daily study reminder
  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Time for a quick quiz! 🎓",
      body: "Maintain your level and test your knowledge gap map today!",
      sound: true,
    },
    trigger: {
      hour: mostActiveHour,
      minute: 0,
      repeats: true,
    },
  });
  console.log(`Scheduled daily quiz reminder at: ${mostActiveHour}:00`);

  // 2. Check if streak is at risk
  let hasQuizzedToday = false;
  if (lastActiveDate) {
    const lastActive = new Date(lastActiveDate);
    const today = new Date();
    hasQuizzedToday = lastActive.toDateString() === today.toDateString();
  }

  if (!hasQuizzedToday && streakCount > 0) {
    const warningTime = new Date();
    warningTime.setHours(20, 0, 0, 0); // 8:00 PM today

    // Only schedule if 8 PM has not already passed today
    if (warningTime > new Date()) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "Streak at risk! 🔥⚠️",
          body: `Complete a quiz before midnight to protect your ${streakCount}-day streak!`,
          sound: true,
        },
        trigger: warningTime,
      });
      console.log('Scheduled streak risk warning notification for 8:00 PM.');
    }
  }
}
