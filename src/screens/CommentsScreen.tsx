import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Markdown } from '@/components/Markdown';
import { useSession } from '@/context/session';
import {
  addComment,
  deleteComment,
  fetchComments,
  fetchPost,
  type Comment,
  type Post,
} from '@/lib/posts';
import { useTheme } from '@/theme/ThemeProvider';

const MAX_LENGTH = 2200;

export default function CommentsScreen() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const { session } = useSession();
  const { colors } = useTheme();
  const userId = session?.user.id;

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([fetchPost(postId), fetchComments(postId)])
        .then(([p, c]) => {
          setPost(p);
          setComments(c);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : 'Could not load comments'))
        .finally(() => setLoading(false)),
    [postId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const body = text.trim();
    if (!body || !userId || sending) return;
    setSending(true);
    try {
      const created = await addComment(postId, userId, body);
      setComments((prev) => [...prev, created]);
      setText('');
    } catch (e) {
      Alert.alert('Could not post comment', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setSending(false);
    }
  };

  const remove = (comment: Comment) => {
    Alert.alert('Delete comment?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteComment(comment.id);
            setComments((prev) => prev.filter((c) => c.id !== comment.id));
          } catch (e) {
            Alert.alert('Could not delete comment', e instanceof Error ? e.message : 'Unknown error');
          }
        },
      },
    ]);
  };

  const canDelete = (c: Comment) => c.author_id === userId || post?.author_id === userId;

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Stack.Screen options={{ title: 'Comments' }} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : (
        <FlatList
          style={styles.flex}
          data={comments}
          keyExtractor={(c) => c.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            post?.description ? (
              <View style={[styles.row, styles.caption, { borderBottomColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.placeholder }]} />
                <View style={styles.flex}>
                  <Text style={[styles.author, { color: colors.text }]}>{post.author.username}</Text>
                  <Markdown>{post.description}</Markdown>
                </View>
              </View>
            ) : undefined
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.placeholder }]} />
              <View style={styles.flex}>
                <Text style={[styles.author, { color: colors.text }]}>{item.author.username}</Text>
                <Markdown>{item.body}</Markdown>
              </View>
              {canDelete(item) ? (
                <Pressable onPress={() => remove(item)} hitSlop={8} accessibilityLabel="Delete comment">
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: error ? colors.danger : colors.textSecondary }}>
                {error ?? 'No comments yet. Markdown is supported.'}
              </Text>
            </View>
          }
        />
      )}

      <View style={[styles.composer, { borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, color: colors.text }]}
          value={text}
          onChangeText={setText}
          placeholder="Add a comment… (**bold**, _italic_)"
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={MAX_LENGTH}
        />
        <Pressable onPress={send} disabled={!text.trim() || sending} hitSlop={8}>
          <Text style={[styles.post, { color: colors.primary, opacity: text.trim() && !sending ? 1 : 0.4 }]}>
            Post
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  row: { flexDirection: 'row', gap: 10, paddingHorizontal: 12, paddingVertical: 8 },
  caption: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: 12, marginBottom: 4 },
  avatar: { width: 32, height: 32, borderRadius: 16 },
  author: { fontWeight: '600', marginBottom: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: { flex: 1, maxHeight: 120, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  post: { fontWeight: '600', paddingBottom: 8 },
});
