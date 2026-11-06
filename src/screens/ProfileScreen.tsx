import { Pressable, StyleSheet, Text, View } from 'react-native';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useSession } from '@/context/session';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const { colors } = useTheme();
  const username = session?.user.user_metadata?.username ?? session?.user.email;

  return (
    <View style={styles.container}>
      <View style={[styles.avatar, { backgroundColor: colors.placeholder }]} />
      <Text style={[styles.name, { color: colors.text }]}>{username}</Text>
      <Text style={[styles.bio, { color: colors.textSecondary }]}>Your bio goes here.</Text>
      <ThemeSwitcher />
      <Pressable style={[styles.logout, { backgroundColor: colors.surface }]} onPress={signOut}>
        <Text style={[styles.logoutText, { color: colors.text }]}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 4 },
  logout: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  logoutText: { fontWeight: '600' },
});
