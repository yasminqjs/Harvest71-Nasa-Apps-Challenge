import { Platform } from 'react-native';

export async function triggerLocalPreventiveAlert(
  title: string,
  body: string
): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  try {
    const Notifications = await import('expo-notifications');
    const perms = await Notifications.getPermissionsAsync();
    let finalStatus = perms.status;
    if (finalStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
    }
    if (finalStatus === 'granted') {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          sound: true,
        },
        trigger: null,
      });
    }
  } catch {
    // Fallback silencioso no Expo Go Android
  }
}
