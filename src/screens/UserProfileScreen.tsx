import { Ionicons } from '@expo/vector-icons';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Avatar from '@/components/Avatar';
import BioText from '@/components/BioText';
import { useSession } from '@/context/session';
import { fetchPosts, fetchProfile, type Post, type Profile } from '@/lib/posts';
import { fetchFollowCounts, follow, getFollowState, unfollow, type FollowState } from '@/lib/users';
import { useTheme } from '@/theme/ThemeProvider';

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const myId = session?.user.id;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const [state, setState] = useState<FollowState>('none');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id || !myId) return;
    try {
      const [p, fs, c] = await Promise.all([fetchProfile(id), getFollowState(myId, id), fetchFollowCounts(id)]);
      setProfile(p);
      setState(fs);
      setCounts(c);
      // RLS returns nothing for private accounts we don't follow.
      setPosts(await fetchPosts({ authorId: id, limit: 60 }));
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [id, myId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const canSeePosts = !!profile && (!profile.is_private || state === 'accepted' || id === myId);

  const refreshAfterChange = async (next: FollowState) => {
    setState(next);
    if (!id) return;
    fetchFollowCounts(id).then(setCounts).catch(() => {});
    fetchPosts({ authorId: id, limit: 60 }).then(setPosts).catch(() => {});
  };

  const doUnfollow = async () => {
    if (!myId || !id) return;
    setBusy(true);
    try {
      await unfollow(myId, id);
      await refreshAfterChange('none');
    } catch {
      Alert.alert('Something went wrong', 'Could not update follow status.');
    } finally {
      setBusy(false);
    }
  };

  const onPressFollow = async () => {
    if (!myId || !id || busy) return;
    if (state !== 'none') {
      const label = state === 'pending' ? 'Cancel follow request?' : `Unfollow @${profile?.username}?`;
      Alert.alert(label, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: state === 'pending' ? 'Cancel request' : 'Unfollow', style: 'destructive', onPress: doUnfollow },
      ]);
      return;
    }
    setBusy(true);
    try {
      await refreshAfterChange(await follow(myId, id));
    } catch {
      Alert.alert('Something went wrong', 'Could not update follow status.');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.text} />
      </View>
    );
  }
  if (failed || !profile) {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textSecondary }}>User not found.</Text>
      </View>
    );
  }

  const tile = width / 3;
  const isMe = id === myId;
  const following = state === 'accepted';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: profile.username }} />
      <Avatar path={profile.avatar_path} size={96} />
      <Text style={[styles.name, { color: colors.text }]}>{profile.username}</Text>
      {profile.full_name ? <Text style={{ color: colors.text }}>{profile.full_name}</Text> : null}
      {profile.bio ? (
        <View style={styles.bio}>
          <BioText markdown={profile.bio} />
        </View>
      ) : null}

      <View style={styles.stats}>
        <Stat label="posts" value={canSeePosts ? posts.length : '–'} color={colors.text} />
        <Stat label="followers" value={counts.followers} color={colors.text} />
        <Stat label="following" value={counts.following} color={colors.text} />
      </View>

      {!isMe ? (
        <Pressable
          disabled={busy}
          onPress={onPressFollow}
          style={[
            styles.followBtn,
            { backgroundColor: state === 'none' ? colors.primary : colors.surface, opacity: busy ? 0.6 : 1 },
          ]}
        >
          <Text style={[styles.bold, { color: state === 'none' ? colors.onPrimary : colors.text }]}>
            {following ? 'Following' : state === 'pending' ? 'Requested' : 'Follow'}
          </Text>
        </Pressable>
      ) : null}

      {canSeePosts ? (
        <View style={styles.grid}>
          {posts.map((p) => (
            <View key={p.id} style={{ width: tile, height: tile, backgroundColor: colors.placeholder, padding: 1 }}>
              {p.media[0]?.url ? <Image source={{ uri: p.media[0].url }} style={{ flex: 1 }} resizeMode="cover" /> : null}
            </View>
          ))}
          {posts.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No posts yet.</Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.private, { borderTopColor: colors.border }]}>
          <Ionicons name="lock-closed-outline" size={40} color={colors.text} />
          <Text style={[styles.bold, { color: colors.text, marginTop: 8 }]}>This account is private</Text>
          <Text style={{ color: colors.textSecondary, marginTop: 4 }}>Follow this account to see their posts.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.bold, { color }]}>{value}</Text>
      <Text style={{ color }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { alignItems: 'center', paddingTop: 24, paddingBottom: 32 },
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 8, paddingHorizontal: 24, alignSelf: 'stretch' },
  stats: { flexDirection: 'row', gap: 32, marginTop: 16 },
  stat: { alignItems: 'center' },
  followBtn: { marginTop: 16, marginBottom: 16, paddingVertical: 8, paddingHorizontal: 32, borderRadius: 8 },
  bold: { fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignSelf: 'stretch' },
  empty: { width: '100%', textAlign: 'center', marginTop: 24 },
  private: { alignSelf: 'stretch', alignItems: 'center', paddingTop: 32, borderTopWidth: StyleSheet.hairlineWidth },
});
