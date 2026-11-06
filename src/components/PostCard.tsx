import { useCallback, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Post } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

export function PostCard({ post, onToggleLike }: { post: Post; onToggleLike: () => void }) {
  const { width } = useWindowDimensions();
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  // Must be a stable reference: FlatList doesn't support changing it on the fly.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
      const first = viewableItems[0]?.index;
      if (first != null) setIndex(first);
    },
    [],
  );

  return (
    <View style={styles.post}>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.placeholder }]} />
        <View>
          <Text style={[styles.bold, { color: colors.text }]}>{post.author.username}</Text>
          {post.location_name ? <Text style={[styles.muted, { color: colors.textSecondary }]}>{post.location_name}</Text> : null}
        </View>
      </View>

      {/* Carousel */}
      <FlatList
        data={post.media}
        keyExtractor={(m) => m.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        renderItem={({ item }) => (
          <View style={{ width, aspectRatio: 1, backgroundColor: colors.placeholder }}>
            {item.url ? (
              <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            ) : null}
          </View>
        )}
      />
      {post.media.length > 1 ? (
        <View style={styles.dots}>
          {post.media.map((m, i) => (
            <View key={m.id} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      ) : null}

      <View style={styles.padded}>
        <Pressable onPress={onToggleLike} hitSlop={8} style={styles.like}>
          <Ionicons
            name={post.liked_by_me ? 'heart' : 'heart-outline'}
            size={26}
            color={post.liked_by_me ? '#e0245e' : colors.text}
          />
        </Pressable>
        <Text style={[styles.bold, { color: colors.text }]}>{post.like_count} likes</Text>
        {post.description ? (
          <Text style={{ color: colors.text }}>
            <Text style={styles.bold}>{post.author.username} </Text>
            {post.description}
          </Text>
        ) : null}
        {post.comment_count > 0 ? (
          <Text style={[styles.muted, { color: colors.textSecondary }]}>View all {post.comment_count} comments</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: { marginBottom: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  padded: { paddingHorizontal: 12, paddingTop: 8, gap: 4 },
  like: { alignSelf: 'flex-start' },
  bold: { fontWeight: '600' },
  muted: { fontSize: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingTop: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ccc' },
  dotActive: { backgroundColor: '#3897f0' },
});
