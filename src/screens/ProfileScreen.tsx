import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import ThemeSwitcher from '@/components/ThemeSwitcher';
import { useSession } from '@/context/session';
import { fetchPosts, fetchProfile, type Post, type Profile } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProfileScreen() {
  const { session, signOut } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    if (!userId) return;
    fetchProfile(userId).then(setProfile).catch(() => {});
    fetchPosts({ authorId: userId, limit: 60 }).then(setPosts).catch(() => {});
  }, [userId]);

  const tile = width / 3;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={[styles.avatar, { backgroundColor: colors.placeholder }]} />
      <Text style={[styles.name, { color: colors.text }]}>{profile?.username ?? session?.user.email}</Text>
      {profile?.full_name ? <Text style={{ color: colors.text }}>{profile.full_name}</Text> : null}
      <Text style={[styles.bio, { color: colors.textSecondary }]}>{profile?.bio ?? 'No bio yet.'}</Text>
      <Text style={[styles.stat, { color: colors.text }]}>
        <Text style={styles.bold}>{posts.length}</Text> posts
        {profile?.is_private ? '  ·  🔒 Private' : ''}
      </Text>

      <View style={styles.grid}>
        {posts.map((p) => (
          <View key={p.id} style={{ width: tile, height: tile, backgroundColor: colors.placeholder, padding: 1 }}>
            {p.media[0]?.url ? (
              <Image source={{ uri: p.media[0].url }} style={{ flex: 1 }} resizeMode="cover" />
            ) : null}
          </View>
        ))}
      </View>

      <ThemeSwitcher />

      <Pressable style={[styles.logout, { backgroundColor: colors.surface }]} onPress={signOut}>
        <Text style={[styles.bold, { color: colors.text }]}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingTop: 32, paddingBottom: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 4 },
  stat: { marginTop: 12, marginBottom: 16 },
  bold: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch' },
  logout: {
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
});
