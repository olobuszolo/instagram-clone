import { FlatList, StyleSheet, Text, View } from 'react-native';
import { posts } from '../data/posts';

export default function HomeScreen() {
  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <View style={styles.post}>
          <Text style={styles.user}>{item.user}</Text>
          <View style={styles.image} />
          <Text style={styles.likes}>{item.likes} likes</Text>
          <Text>
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
  image: { aspectRatio: 1, backgroundColor: '#ddd', marginVertical: 8 },
  likes: { fontWeight: '600', marginBottom: 4 },
});
