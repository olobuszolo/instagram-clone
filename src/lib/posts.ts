import { supabase } from '@/lib/supabase';

const SIGNED_URL_TTL = 60 * 60; // seconds

export type PostMedia = {
  id: string;
  storage_path: string;
  media_type: 'image' | 'video';
  width: number | null;
  height: number | null;
  position: number;
  url: string | null; // signed URL, filled in by fetchPosts
};

export type Post = {
  id: string;
  author_id: string;
  description: string | null;
  location_name: string | null;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: { username: string; avatar_path: string | null };
  media: PostMedia[];
  liked_by_me: boolean;
};

type PostRow = Omit<Post, 'author' | 'media' | 'liked_by_me'> & {
  author: { username: string; avatar_path: string | null } | null;
  media: Omit<PostMedia, 'url'>[];
};

const POST_SELECT = `
  id, author_id, description, location_name, like_count, comment_count, created_at,
  author:profiles!posts_author_id_fkey ( username, avatar_path ),
  media:post_media ( id, storage_path, media_type, width, height, position )
`;

/**
 * Posts visible to the current user (RLS hides private accounts the user
 * doesn't follow), newest first. Pass `authorId` for a single user's posts.
 */
export async function fetchPosts(opts: { authorId?: string; postId?: string; before?: string; limit?: number } = {},
) {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(opts.limit ?? 20);
  if (opts.authorId) query = query.eq('author_id', opts.authorId);
  if (opts.postId) query = query.eq('id', opts.postId);
  if (opts.before) query = query.lt('created_at', opts.before);

  const { data, error } = await query.overrideTypes<PostRow[], { merge: false }>();
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const paths = rows.flatMap((r) => r.media.map((m) => m.storage_path));
  const urlByPath = new Map<string, string>();
  if (paths.length > 0) {
    const { data: signed, error: signError } = await supabase.storage
      .from('posts')
      .createSignedUrls(paths, SIGNED_URL_TTL);
    if (signError) throw signError;
    for (const s of signed ?? []) if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl);
  }

  const { data: auth } = await supabase.auth.getUser();
  const likedIds = new Set<string>();
  if (auth.user) {
    const { data: likes, error: likesError } = await supabase
      .from('likes')
      .select('post_id')
      .eq('user_id', auth.user.id)
      .in('post_id', rows.map((r) => r.id));
    if (likesError) throw likesError;
    for (const l of likes ?? []) likedIds.add(l.post_id);
  }

  return rows.map<Post>((r) => ({
    ...r,
    author: r.author ?? { username: 'unknown', avatar_path: null },
    media: [...r.media]
      .sort((a, b) => a.position - b.position)
      .map((m) => ({ ...m, url: urlByPath.get(m.storage_path) ?? null })),
    liked_by_me: likedIds.has(r.id),
  }));
}

export async function setLiked(postId: string, userId: string, liked: boolean) {
  const { error } = liked
    ? await supabase.from('likes').insert({ post_id: postId, user_id: userId })
    : await supabase.from('likes').delete().eq('post_id', postId).eq('user_id', userId);
  // 23505 = already liked; treat as success.
  if (error && error.code !== '23505') throw error;
}

export type Profile = {
  id: string;
  username: string;
  full_name: string | null;
  bio: string | null;
  is_private: boolean;
};

export async function fetchProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, bio, is_private')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export type MapPost = {
  post_id: string;
  author_id: string;
  latitude: number;
  longitude: number;
  location_name: string | null;
  created_at: string;
};

/** Posts visible to me that have a location (RLS applies), newest first. */
export async function fetchMapPosts(max = 500) {
  // PostGIS geography rejects boxes with a 180°-long edge ("Antipodal edge
  // detected"), so the world is queried as four 90°-wide strips, lat ±89.
  const strips = [-180, -90, 0, 90].map((minLng) =>
    supabase.rpc('get_posts_in_bounds', {
      min_lng: minLng,
      min_lat: -89,
      max_lng: minLng + 90,
      max_lat: 89,
      max_results: max,
    }),
  );
  const byId = new Map<string, MapPost>();
  for (const { data, error } of await Promise.all(strips)) {
    if (error) throw error;
    for (const p of (data ?? []) as MapPost[]) byId.set(p.post_id, p);
  }
  return [...byId.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, max);
}
