import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSession } from '@/context/session';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const username = session?.user.user_metadata?.username ?? session?.user.email;

  return (
    <View style={styles.container}>
      <View style={styles.avatar} />
      <Text style={styles.name}>{username}</Text>
      <Text style={styles.bio}>Your bio goes here.</Text>
      <Pressable style={styles.logout} onPress={signOut}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ddd' },
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 4, color: '#888' },
  logout: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#efefef',
  },
  logoutText: { fontWeight: '600' },
});
