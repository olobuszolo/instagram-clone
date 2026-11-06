import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export default function SearchScreen() {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
        placeholder="Search"
        placeholderTextColor={colors.textSecondary}
      />
      <Text style={[styles.hint, { color: colors.textSecondary }]}>Search results will appear here.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  input: { borderRadius: 8, padding: 10 },
  hint: { marginTop: 16 },
});
