import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // PKCE: the magic link returns a ?code= that the app exchanges for a session.
    flowType: 'pkce',
    // On web, let Supabase auto-complete the session from the redirect URL.
    // On native, the deep-link handler in app/_layout.tsx exchanges the code.
    detectSessionInUrl: Platform.OS === 'web',
  },
});
