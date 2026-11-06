import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemePreference } from '@/theme/ThemeProvider';

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function ThemeSwitcher() {
  const { preference, setPreference, colors } = useTheme();

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.title, { color: colors.text }]}>Appearance</Text>
      <View style={[styles.segmented, { backgroundColor: colors.surface }]}>
        {OPTIONS.map((o) => {
          const active = o.value === preference;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.segment, active && { backgroundColor: colors.primary }]}
              onPress={() => setPreference(o.value)}
            >
              <Text style={[styles.label, { color: active ? colors.onPrimary : colors.text }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignSelf: 'stretch', paddingHorizontal: 24, marginTop: 32 },
  title: { fontWeight: '600', marginBottom: 8 },
  segmented: { flexDirection: 'row', borderRadius: 8, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, borderRadius: 6, alignItems: 'center' },
  label: { fontWeight: '600' },
});
