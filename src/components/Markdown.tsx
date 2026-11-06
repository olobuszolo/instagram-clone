import { useMemo } from 'react';
import { Linking } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { useTheme } from '@/theme/ThemeProvider';

/** Theme-aware markdown renderer used for post descriptions and comments. */
export function Markdown({ children, fontSize = 14 }: { children: string; fontSize?: number }) {
  const { colors } = useTheme();
  const markdownStyle = useMemo<MarkdownStyle>(
    () => ({
      paragraph: { color: colors.text, fontSize, marginTop: 0, marginBottom: 4 },
      strong: { color: colors.text },
      link: { color: colors.primary, underline: false },
      code: { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
      blockquote: { color: colors.textSecondary },
    }),
    [colors, fontSize],
  );

  return (
    <EnrichedMarkdownText
      markdown={children}
      markdownStyle={markdownStyle}
      onLinkPress={({ url }) => {
        void Linking.openURL(url).catch(() => {});
      }}
    />
  );
}
