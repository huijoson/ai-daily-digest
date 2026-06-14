import { useState } from 'react';
import { Alert, Button, Text, TextInput, View } from 'react-native';
import { supabase } from '../src/client/supabase';
import { isValidEmail } from '../src/client/validation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!isValidEmail(email)) { Alert.alert('Please enter a valid email'); return; }
    setBusy(true);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) Alert.alert('Sign-in failed', error.message);
    else setSent(true);
  }

  return (
    <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: '600' }}>AI Daily Digest</Text>
      {sent ? (
        <Text>Check your email for the magic link.</Text>
      ) : (
        <>
          <TextInput
            placeholder="you@example.com"
            autoCapitalize="none" keyboardType="email-address"
            value={email} onChangeText={setEmail}
            style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12 }}
          />
          <Button title={busy ? 'Sending…' : 'Send magic link'} onPress={send} disabled={busy} />
        </>
      )}
    </View>
  );
}
