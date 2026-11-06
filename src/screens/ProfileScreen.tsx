import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Avatar from '@/components/Avatar';
import BioText from '@/components/BioText';
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

  // Refetch on focus so edits made in the edit-profile modal show up.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      fetchProfile(userId).then(setProfile).catch(() => {});
      fetchPosts({ authorId: userId, limit: 60 }).then(setPosts).catch(() => {});
    }, [userId]),
  );

  const tile = width / 3;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Avatar path={profile?.avatar_path} size={96} />
      <Text style={[styles.name, { color: colors.text }]}>{profile?.username ?? session?.user.email}</Text>
      {profile?.full_name ? <Text style={{ color: colors.text }}>{profile.full_name}</Text> : null}
      <View style={styles.bio}>
        {profile?.bio ? (
          <BioText markdown={profile.bio} />
        ) : (
          <Text style={{ color: colors.textSecondary }}>No bio yet.</Text>
        )}
      </View>
      <Pressable style={[styles.edit, { backgroundColor: colors.surface }]} onPress={() => router.push('/edit-profile')}>
        <Text style={[styles.bold, { color: colors.text }]}>Edit profile</Text>
      </Pressable>
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
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 8, paddingHorizontal: 24, alignSelf: 'stretch' },
  edit: { marginTop: 8, paddingVertical: 8, paddingHorizontal: 20, borderRadius: 8 },
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
