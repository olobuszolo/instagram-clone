import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Link } from 'expo-router';
import { useSession } from '@/context/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const { signIn, signUp } = useSession();
  const { colors } = useTheme();
  const isSignUp = mode === 'sign-up';
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const inputThemed = {
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  };
  const canSubmit = !!email && password.length >= 6 && (!isSignUp || !!username) && !busy;

  async function submit() {
    setBusy(true);
    setError(null);
    setInfo(null);
    const result = isSignUp
      ? await signUp(email.trim(), password, username.trim())
      : await signIn(email.trim(), password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.needsEmailConfirmation) setInfo('Check your email to confirm your account.');
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={[styles.logo, { color: colors.text }]}>Instagram</Text>
      <TextInput
        style={[styles.input, inputThemed]}
        placeholderTextColor={colors.textSecondary}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      {isSignUp && (
        <TextInput
          style={[styles.input, inputThemed]}
          placeholderTextColor={colors.textSecondary}
          placeholder="Username"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
      )}
      <TextInput
        style={[styles.input, inputThemed]}
        placeholderTextColor={colors.textSecondary}
        placeholder="Password (min. 6 characters)"
        secureTextEntry
        autoComplete={isSignUp ? 'new-password' : 'current-password'}
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={canSubmit ? submit : undefined}
      />
      {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}
      {info && <Text style={[styles.info, { color: colors.text }]}>{info}</Text>}
      <Pressable
        style={[styles.button, { backgroundColor: colors.primary }, !canSubmit && styles.buttonDisabled]}
        disabled={!canSubmit}
        onPress={submit}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{isSignUp ? 'Sign up' : 'Log in'}</Text>
        )}
      </Pressable>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.textSecondary }}>
          {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        </Text>
        <Link href={isSignUp ? '/sign-in' : '/sign-up'} replace style={[styles.link, { color: colors.primary }]}>
          {isSignUp ? 'Log in' : 'Sign up'}
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '700', textAlign: 'center', marginBottom: 32 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
  },
  button: { borderRadius: 8, padding: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontWeight: '600' },
  error: { marginBottom: 8 },
  info: { marginBottom: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  link: { fontWeight: '600' },
});
