import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { PostCard } from '@/components/PostCard';
import { useSession } from '@/context/session';
import { fetchPosts, setLiked, type Post } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetchPosts()
        .then((rows) => {
          setPosts(rows);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load posts'))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleLike = async (post: Post) => {
    if (!userId) return;
    const liked = !post.liked_by_me;
    const patch = (p: Post): Post =>
      p.id === post.id
        ? { ...p, liked_by_me: liked, like_count: Math.max(p.like_count + (liked ? 1 : -1), 0) }
        : p;
    setPosts((prev) => prev.map(patch));
    try {
      await setLiked(post.id, userId, liked);
    } catch (e) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p))); // roll back
      Alert.alert('Could not update like', e instanceof Error ? e.message : JSON.stringify(e));
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => <PostCard post={item} onToggleLike={() => toggleLike(item)} />}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={error ? [styles.error, { color: colors.danger }] : { color: colors.textSecondary }}>
            {error ?? 'No posts yet.'}
          </Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  error: { textAlign: 'center' },
});
