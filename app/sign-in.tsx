import { useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import * as Linking from 'expo-linking';
import { supabase } from '../src/client/supabase';
import { isValidEmail } from '../src/client/validation';
import { colors, spacing, styles as t } from '../src/client/theme';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!isValidEmail(email)) { Alert.alert('Please enter a valid email'); return; }
    setBusy(true);
    const emailRedirectTo = Linking.createURL('/');
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo } });
    setBusy(false);
    if (error) Alert.alert('Sign-in failed', error.message);
    else setSent(true);
  }

  return (
    <View style={[t.screenBg, { padding: spacing.xl, justifyContent: 'center', gap: spacing.md }]}>
      <Text style={[t.headerTitle, { fontSize: 40 }]}>AI Daily Digest</Text>
      {sent ? (
        <Text style={{ color: colors.ink }}>Check your email for the magic link.</Text>
      ) : (
        <>
          <TextInput
            placeholder="you@example.com"
            autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail}
            style={{ borderWidth: 2.5, borderColor: colors.ink, borderRadius: 10, padding: 12, backgroundColor: colors.card }}
          />
          <Pressable style={[t.comicButton, { opacity: busy ? 0.6 : 1 }]} onPress={send} disabled={busy}>
            <Text style={t.comicButtonText}>{busy ? 'Sending…' : 'Send magic link'}</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
