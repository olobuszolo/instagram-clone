import { StyleSheet, Text, TextInput, View } from 'react-native';

export default function SearchScreen() {
  return (
    <View style={styles.container}>
      <TextInput style={styles.input} placeholder="Search" />
      <Text style={styles.hint}>Search results will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  input: { backgroundColor: '#eee', borderRadius: 8, padding: 10 },
  hint: { marginTop: 16, color: '#888' },
});
