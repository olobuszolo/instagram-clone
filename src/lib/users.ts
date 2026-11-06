import Storage from 'expo-sqlite/kv-store';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/posts';

export type FollowState = 'none' | 'pending' | 'accepted';

const PROFILE_COLUMNS = 'id, username, full_name, bio, avatar_path, is_private';

/** Escapes characters that are special in LIKE patterns. */
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Case-insensitive prefix/substring search over username and full name. */
export async function searchProfiles(term: string, excludeId?: string, limit = 30) {
  const q = term.trim().replace(/^@/, '');
  if (!q) return [];
  const pattern = `%${escapeLike(q)}%`;
  // Commas/parentheses would break the PostgREST `or` filter syntax.
  const safe = pattern.replace(/[,()"]/g, '');
  let query = supabase
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .or(`username.ilike.${safe},full_name.ilike.${safe}`)
    .limit(limit);
  if (excludeId) query = query.neq('id', excludeId);
  const { data, error } = await query;
  if (error) throw error;
  const lower = q.toLowerCase();
  // Usernames starting with the term first, then alphabetical.
  return ((data ?? []) as Profile[]).sort((a, b) => {
    const as = a.username.toLowerCase().startsWith(lower) ? 0 : 1;
    const bs = b.username.toLowerCase().startsWith(lower) ? 0 : 1;
    return as - bs || a.username.localeCompare(b.username);
  });
}

export async function getFollowState(me: string, target: string): Promise<FollowState> {
  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', me)
    .eq('following_id', target)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.status as FollowState) : 'none';
}

/** The server decides the resulting status (pending for private accounts). */
export async function follow(me: string, target: string): Promise<FollowState> {
  const { error } = await supabase.from('follows').insert({ follower_id: me, following_id: target });
  // 23505 = already following.
  if (error && error.code !== '23505') throw error;
  return getFollowState(me, target);
}

export async function unfollow(me: string, target: string) {
  const { error } = await supabase.from('follows').delete().eq('follower_id', me).eq('following_id', target);
  if (error) throw error;
}

export async function fetchFollowCounts(userId: string) {
  const [followers, following] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', userId)
      .eq('status', 'accepted'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', userId)
      .eq('status', 'accepted'),
  ]);
  if (followers.error) throw followers.error;
  if (following.error) throw following.error;
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

// ---------------------------------------------------------- recent searches
const RECENT_KEY = 'recent-user-searches';
const RECENT_MAX = 15;

export async function loadRecentSearches(): Promise<Profile[]> {
  try {
    const raw = await Storage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as Profile[]) : [];
  } catch {
    return [];
  }
}

async function saveRecent(list: Profile[]) {
  try {
    await Storage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {}
}

export async function addRecentSearch(profile: Profile) {
  const list = (await loadRecentSearches()).filter((p) => p.id !== profile.id);
  const next = [profile, ...list].slice(0, RECENT_MAX);
  await saveRecent(next);
  return next;
}

export async function removeRecentSearch(id: string) {
  const next = (await loadRecentSearches()).filter((p) => p.id !== id);
  await saveRecent(next);
  return next;
}

export async function clearRecentSearches() {
  await saveRecent([]);
}
