import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../src/client/supabase';
import { registerPushToken } from '../src/client/push';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const onSignIn = segments[0] === 'sign-in';
    if (!session && !onSignIn) router.replace('/sign-in');
    else if (session && onSignIn) router.replace('/');
  }, [ready, session, segments, router]);

  // Register for push notifications once signed in.
  useEffect(() => {
    if (session) registerPushToken().catch(() => {});
  }, [session]);

  // Tapping a digest notification opens the Today feed.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      router.replace('/');
    });
    return () => sub.remove();
  }, [router]);

  // Complete magic-link sign-in: exchange the deep-link's code for a session.
  useEffect(() => {
    async function handleUrl(url: string | null) {
      if (!url) return;
      const parsed = Linking.parse(url);
      const code = parsed.queryParams?.code;
      if (typeof code === 'string') {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
      }
    }
    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  return <Stack screenOptions={{ headerShown: true }} />;
}
