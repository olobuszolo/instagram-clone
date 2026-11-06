import { StyleSheet, Text, View } from 'react-native';

export default function ProfileScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.avatar} />
      <Text style={styles.name}>your_username</Text>
      <Text style={styles.bio}>Your bio goes here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', paddingTop: 32 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ddd' },
  name: { marginTop: 12, fontSize: 18, fontWeight: '600' },
  bio: { marginTop: 4, color: '#888' },
});
