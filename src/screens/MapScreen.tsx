import * as Location from 'expo-location';
import { AppleMaps, GoogleMaps, useLocationPermissions } from 'expo-maps';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PostCard } from '@/components/PostCard';
import { useSession } from '@/context/session';
import { fetchMapPosts, fetchPosts, setLiked, type MapPost, type Post } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

type Camera = { coordinates: { latitude: number; longitude: number }; zoom: number };
const WORLD: Camera = { coordinates: { latitude: 20, longitude: 0 }, zoom: 1 };

// Supabase errors (PostgrestError) are plain objects, not Error instances.
function errorMessage(e: unknown, fallback: string) {
  if (e && typeof e === 'object' && 'message' in e && typeof e.message === 'string') {
    return `${fallback}: ${e.message}`;
  }
  return fallback;
}

export default function MapScreen() {
  const { session } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;
  const [permission, requestPermission] = useLocationPermissions();
  const [pins, setPins] = useState<MapPost[]>([]);
  const [camera, setCamera] = useState<Camera>(WORLD);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Post | null>(null);
  const [opening, setOpening] = useState(false);

  useFocusEffect(
    useCallback(() => {
      fetchMapPosts()
        .then((rows) => {
          setPins(rows);
          setError(null);
        })
        .catch((e) => setError(errorMessage(e, 'Could not load map')));
    }, []),
  );

  // Ask for location permission, then center the map on the user.
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain) void requestPermission();
  }, [permission, requestPermission]);

  useEffect(() => {
    if (!permission?.granted) return;
    // getCurrentPositionAsync can hang when no fix is available (e.g. a
    // simulator with no simulated location), so cap it and fall back.
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
    Promise.race([Location.getCurrentPositionAsync({}), timeout])
      .then((pos) => pos ?? Location.getLastKnownPositionAsync())
      .then((pos) => {
        if (!pos) return;
        setCamera({
          coordinates: { latitude: pos.coords.latitude, longitude: pos.coords.longitude },
          zoom: 11,
        });
      })
      .catch(() => {});
  }, [permission?.granted]);

  const openPost = async (postId?: string) => {
    if (!postId || opening) return;
    setOpening(true);
    try {
      const [post] = await fetchPosts({ postId, limit: 1 });
      if (post) setSelected(post);
    } catch (e) {
      setError(errorMessage(e, 'Could not open post'));
    } finally {
      setOpening(false);
    }
  };

  const toggleLike = async () => {
    if (!userId || !selected) return;
    const post = selected;
    const liked = !post.liked_by_me;
    setSelected({
      ...post,
      liked_by_me: liked,
      like_count: Math.max(post.like_count + (liked ? 1 : -1), 0),
    });
    try {
      await setLiked(post.id, userId, liked);
    } catch {
      setSelected(post); // roll back
    }
  };

  if (Platform.OS !== 'ios' && Platform.OS !== 'android') {
    return (
      <View style={styles.center}>
        <Text style={{ color: colors.textSecondary }}>The map is available on iOS and Android only.</Text>
      </View>
    );
  }

  const markers = pins.map((p) => ({
    id: p.post_id,
    coordinates: { latitude: p.latitude, longitude: p.longitude },
    title: p.location_name ?? undefined,
  }));
  const properties = { isMyLocationEnabled: permission?.granted ?? false };
  const mapKey = `${camera.coordinates.latitude},${camera.coordinates.longitude}`;

  return (
    <View style={styles.flex}>
      {Platform.OS === 'ios' ? (
        <AppleMaps.View
          key={mapKey}
          style={styles.flex}
          cameraPosition={camera}
          markers={markers}
          properties={properties}
          onMarkerClick={(m) => void openPost(m.id)}
        />
      ) : (
        <GoogleMaps.View
          key={mapKey}
          style={styles.flex}
          cameraPosition={camera}
          markers={markers}
          properties={properties}
          onMarkerClick={(m) => void openPost(m.id)}
        />
      )}
      {opening && (
        <View style={styles.overlay} pointerEvents="none">
          <ActivityIndicator />
        </View>
      )}
      {error && (
        <View style={[styles.banner, { backgroundColor: colors.surface }]}>
          <Text style={{ color: colors.danger }}>{error}</Text>
        </View>
      )}
      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setSelected(null)}
      >
        <View style={[styles.flex, { backgroundColor: colors.background }]}>
          <Pressable onPress={() => setSelected(null)} style={styles.close} hitSlop={12}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>Close</Text>
          </Pressable>
          {selected && (
            <FlatList
              data={[selected]}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => <PostCard post={item} onToggleLike={toggleLike} />}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  banner: { position: 'absolute', top: 12, left: 12, right: 12, padding: 10, borderRadius: 8 },
  close: { alignSelf: 'flex-end', padding: 16 },
});
