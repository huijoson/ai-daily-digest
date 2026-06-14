import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/** Request permission, get the Expo push token, and upsert it for the current user.
 *  No-op on simulators or when permission is denied. */
export async function registerPushToken(): Promise<void> {
  if (!Device.isDevice) return;
  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const token = (await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;

  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) return;
  await supabase.from('push_tokens').upsert(
    { user_id: userId, expo_token: token, platform: Platform.OS },
    { onConflict: 'user_id,expo_token' },
  );
}
