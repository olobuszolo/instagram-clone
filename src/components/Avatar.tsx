import { Ionicons } from '@expo/vector-icons';
import { Image, View } from 'react-native';
import { avatarUrl } from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

export default function Avatar({ path, uri, size = 96 }: { path?: string | null; uri?: string | null; size?: number }) {
  const { colors } = useTheme();
  const source = uri ?? avatarUrl(path);
  const style = { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.placeholder };

  if (source) return <Image source={{ uri: source }} style={style} />;
  return (
    <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
      <Ionicons name="person" size={size * 0.5} color={colors.textSecondary} />
    </View>
  );
}
