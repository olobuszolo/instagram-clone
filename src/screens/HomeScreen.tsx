import { FlatList, StyleSheet, Text, View } from 'react-native';
import { posts } from '../data/posts';
import { useTheme } from '@/theme/ThemeProvider';

export default function HomeScreen() {
  const { colors } = useTheme();
  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <View style={styles.post}>
          <Text style={[styles.user, { color: colors.text }]}>{item.user}</Text>
          <View style={[styles.image, { backgroundColor: colors.placeholder }]} />
          <Text style={[styles.likes, { color: colors.text }]}>{item.likes} likes</Text>
          <Text style={{ color: colors.text }}>
            <Text style={styles.user}>{item.user} </Text>
            {item.caption}
          </Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  post: { padding: 12, marginBottom: 8 },
  user: { fontWeight: '600' },
  image: { aspectRatio: 1, marginVertical: 8 },
  likes: { fontWeight: '600', marginBottom: 4 },
});
