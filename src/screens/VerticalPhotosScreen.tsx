import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useSession } from '@/context/session';
import { fetchPost, setLiked, type Post, type PostMedia } from '@/lib/posts';

const PARALLAX = 0.15; // fraction of the page height the photo lags behind its frame

function Page({
  item,
  index,
  height,
  width,
  scrollY,
}: {
  item: PostMedia;
  index: number;
  height: number;
  width: number;
  scrollY: SharedValue<number>;
}) {
  const input = [(index - 1) * height, index * height, (index + 1) * height];

  // The frame fades and shrinks slightly as it leaves / enters.
  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, input, [0.3, 1, 0.3], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(scrollY.value, input, [0.88, 1, 0.88], Extrapolation.CLAMP) },
    ],
    borderRadius: interpolate(scrollY.value, input, [28, 0, 28], Extrapolation.CLAMP),
  }));

  // The photo itself moves slower than its frame (parallax) and zooms a bit.
  const imageStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollY.value,
          input,
          [height * PARALLAX, 0, -height * PARALLAX],
          Extrapolation.CLAMP,
        ),
      },
      { scale: interpolate(scrollY.value, input, [1.15, 1, 1.15], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <View style={{ width, height }}>
      <Animated.View style={[styles.frame, frameStyle]}>
        {item.url ? (
          <Animated.View style={[StyleSheet.absoluteFill, imageStyle]}>
            <Image source={{ uri: item.url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

export default function VerticalPhotosScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { session } = useSession();
  const userId = session?.user.id;
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState(0);
  const scrollY = useSharedValue(0);

  useEffect(() => {
    let cancelled = false;
    fetchPost(postId)
      .then((p) => !cancelled && setPost(p))
      .catch((e) => Alert.alert('Could not load post', e instanceof Error ? e.message : String(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [postId]);

  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const onMomentumEnd = useCallback(
    (e: { nativeEvent: { contentOffset: { y: number } } }) => {
      setCurrent(Math.round(e.nativeEvent.contentOffset.y / height));
    },
    [height],
  );

  const toggleLike = async () => {
    if (!userId || !post) return;
    const liked = !post.liked_by_me;
    setPost({
      ...post,
      liked_by_me: liked,
      like_count: Math.max(post.like_count + (liked ? 1 : -1), 0),
    });
    try {
      await setLiked(post.id, userId, liked);
    } catch (e) {
      setPost(post); // roll back
      Alert.alert('Could not update like', e instanceof Error ? e.message : JSON.stringify(e));
    }
  };

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (loading || !post) {
    return (
      <View style={styles.center}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.white}>Post not found</Text>}
        <Pressable onPress={close} style={[styles.close, { top: insets.top + 8 }]} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Animated.FlatList
        data={post.media}
        keyExtractor={(m) => m.id}
        pagingEnabled
        snapToInterval={height}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumEnd}
        getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
        renderItem={({ item, index }) => (
          <Page item={item} index={index} height={height} width={width} scrollY={scrollY} />
        )}
      />

      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        <Pressable onPress={close} style={[styles.close, { top: insets.top + 8 }]} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Text style={[styles.counter, { top: insets.top + 14 }]}>
          {current + 1} / {post.media.length}
        </Text>

        <View pointerEvents="none" style={styles.dots}>
          {post.media.map((m, i) => (
            <View key={m.id} style={[styles.dot, i === current && styles.dotActive]} />
          ))}
        </View>

        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.flex} pointerEvents="none">
            <Text style={styles.author}>{post.author.username}</Text>
            {post.description ? (
              <Text style={styles.caption} numberOfLines={2}>
                {post.description}
              </Text>
            ) : null}
          </View>
          <View style={styles.actions}>
            <Pressable onPress={toggleLike} hitSlop={8} style={styles.action}>
              <Ionicons
                name={post.liked_by_me ? 'heart' : 'heart-outline'}
                size={30}
                color={post.liked_by_me ? '#e0245e' : '#fff'}
              />
              <Text style={styles.white}>{post.like_count}</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                router.push({ pathname: '/comments/[postId]', params: { postId: post.id } })
              }
              hitSlop={8}
              style={styles.action}
            >
              <Ionicons name="chatbubble-outline" size={28} color="#fff" />
              <Text style={styles.white}>{post.comment_count}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 } as const;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' },
  frame: { flex: 1, overflow: 'hidden', backgroundColor: '#222' },
  flex: { flex: 1 },
  white: { color: '#fff', ...shadow },
  close: { position: 'absolute', left: 12, zIndex: 2 },
  counter: { position: 'absolute', right: 16, color: '#fff', fontWeight: '600', ...shadow },
  dots: { position: 'absolute', right: 10, top: 0, bottom: 0, justifyContent: 'center', gap: 6 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  dotActive: { height: 14, backgroundColor: '#fff' },
  bottom: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    gap: 16,
  },
  author: { color: '#fff', fontWeight: '700', ...shadow },
  caption: { color: '#fff', marginTop: 4, ...shadow },
  actions: { gap: 20, alignItems: 'center' },
  action: { alignItems: 'center', gap: 2 },
});
