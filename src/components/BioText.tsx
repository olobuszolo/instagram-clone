import { Linking } from 'react-native';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { useTheme } from '@/theme/ThemeProvider';

/** Renders a user bio as native formatted text, themed to the app colors. */
export default function BioText({ markdown }: { markdown: string }) {
  const { colors } = useTheme();

  const markdownStyle: MarkdownStyle = {
    paragraph: { color: colors.text, fontSize: 14, marginTop: 0, marginBottom: 4 },
    h1: { color: colors.text, fontSize: 20, marginTop: 0, marginBottom: 4 },
    h2: { color: colors.text, fontSize: 18, marginTop: 0, marginBottom: 4 },
    h3: { color: colors.text, fontSize: 16, marginTop: 0, marginBottom: 4 },
    h4: { color: colors.text, fontSize: 14, marginTop: 0, marginBottom: 4 },
    h5: { color: colors.text, fontSize: 14, marginTop: 0, marginBottom: 4 },
    h6: { color: colors.text, fontSize: 14, marginTop: 0, marginBottom: 4 },
    list: { color: colors.text, fontSize: 14, marginTop: 0, marginBottom: 4 },
    blockquote: { color: colors.textSecondary, fontSize: 14, marginTop: 0, marginBottom: 4 },
    link: { color: colors.primary },
  };

  return (
    <EnrichedMarkdownText
      markdown={markdown}
      markdownStyle={markdownStyle}
      onLinkPress={({ url }) => {
        Linking.openURL(url).catch(() => {});
      }}
    />
  );
}
