import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Avatar from '@/components/Avatar';
import { useSession } from '@/context/session';
import type { Profile } from '@/lib/posts';
import {
  addRecentSearch,
  clearRecentSearches,
  loadRecentSearches,
  removeRecentSearch,
  searchProfiles,
} from '@/lib/users';
import { useTheme } from '@/theme/ThemeProvider';

export default function SearchScreen() {
  const { colors } = useTheme();
  const { session } = useSession();
  const myId = session?.user.id;
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [recent, setRecent] = useState<Profile[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadRecentSearches().then(setRecent);
    }, []),
  );

  // Debounced search; stale responses are ignored.
  useEffect(() => {
    const q = term.trim();
    if (!q) return;
    let cancelled = false;
    const t = setTimeout(() => {
      setLoading(true);
      searchProfiles(q, myId)
        .then((r) => {
          if (cancelled) return;
          setResults(r);
          setSearched(true);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [term, myId]);

  const open = (p: Profile) => {
    addRecentSearch(p).then(setRecent);
    router.push({ pathname: '/user/[id]', params: { id: p.id } });
  };

  const showingRecent = term.trim().length === 0;
  const isLoading = loading && !showingRecent;

  const renderRow = (p: Profile, isRecent: boolean) => (
    <Pressable style={styles.row} onPress={() => open(p)}>
      <Avatar path={p.avatar_path} size={48} />
      <View style={styles.rowText}>
        <Text style={[styles.username, { color: colors.text }]} numberOfLines={1}>
          {p.username}
        </Text>
        {p.full_name ? (
          <Text style={{ color: colors.textSecondary }} numberOfLines={1}>
            {p.full_name}
          </Text>
        ) : null}
      </View>
      {isRecent ? (
        <Pressable hitSlop={10} onPress={() => removeRecentSearch(p.id).then(setRecent)}>
          <Ionicons name="close" size={20} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <View style={[styles.inputWrap, { backgroundColor: colors.surface }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholder="Search"
          placeholderTextColor={colors.textSecondary}
          value={term}
          onChangeText={setTerm}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {isLoading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : null}
        {term.length > 0 && !isLoading ? (
          <Pressable hitSlop={10} onPress={() => setTerm('')}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </View>

      <FlatList
        data={showingRecent ? recent : results}
        keyExtractor={(p) => p.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => renderRow(item, showingRecent)}
        ListHeaderComponent={
          showingRecent && recent.length > 0 ? (
            <View style={styles.header}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>Recent</Text>
              <Pressable onPress={() => clearRecentSearches().then(() => setRecent([]))}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>Clear all</Text>
              </Pressable>
            </View>
          ) : undefined
        }
        ListEmptyComponent={
          showingRecent ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Search for people by username or name.</Text>
          ) : searched && !isLoading ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>No users found.</Text>
          ) : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, paddingHorizontal: 10 },
  input: { flex: 1, paddingVertical: 10, fontSize: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, marginBottom: 4 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  rowText: { flex: 1 },
  username: { fontWeight: '600' },
  hint: { marginTop: 24, textAlign: 'center' },
});
