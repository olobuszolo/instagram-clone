// Seeds the Supabase project with demo users, posts (with images), follows,
// likes and comments — all through the public API as the users themselves,
// so RLS is exercised exactly like in the app.
//
//   node --env-file=.env.local scripts/seed.mjs
//
// Requires: migrations applied, "Confirm email" disabled (auto-confirm).
// Idempotent: users that already have posts are skipped.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error('Missing EXPO_PUBLIC_SUPABASE_* env vars (use --env-file=.env.local)');

const PASSWORD = 'Password123!';

const USERS = [
  { username: 'anna.travels', full_name: 'Anna Nowak', bio: 'Chasing sunsets ☀️', city: ['Kraków', 19.9449, 50.0647] },
  { username: 'marek_codes', full_name: 'Marek Kowalski', bio: 'Coffee, code, mountains.', city: ['Warszawa', 21.0122, 52.2297] },
  { username: 'kasia.private', full_name: 'Kasia Wiśniewska', bio: 'Private account 🔒', city: ['Gdańsk', 18.6466, 54.352], is_private: true },
  { username: 'tomek.photo', full_name: 'Tomek Zieliński', bio: 'Street photography.', city: ['Wrocław', 17.0385, 51.1079] },
  { username: 'ola.eats', full_name: 'Ola Lewandowska', bio: 'Food over everything 🍜', city: ['Poznań', 16.9252, 52.4064] },
];

const CAPTIONS = [
  'Golden hour hits different.', 'Weekend vibes ✨', 'Found this hidden spot today.',
  'No filter needed.', 'Back to the city.', 'Morning walk.', 'Lunch break view.',
  'Trying something new!', 'Can we go back already?', 'Sunday reset.',
];
const COMMENTS = ['Love this! 😍', 'Great shot!', 'Where is this?', 'Wow 🔥', 'Take me there!', 'Beautiful colors.'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const must = (res, what) => {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res.data;
};

const newClient = () =>
  createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

async function signInOrUp(u) {
  const client = newClient();
  const email = `${u.username.replace(/[^a-z0-9]/gi, '')}@seed.example.com`;
  let res = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (res.error) {
    res = await client.auth.signUp({
      email,
      password: PASSWORD,
      options: { data: { username: u.username, full_name: u.full_name } },
    });
    if (res.error) throw new Error(`signUp ${u.username}: ${res.error.message}`);
    if (!res.data.session) throw new Error('No session after sign-up: disable "Confirm email" in Supabase Auth settings.');
  }
  return { client, id: res.data.user.id };
}

async function fetchImage(seed) {
  const r = await fetch(`https://picsum.photos/seed/${encodeURIComponent(seed)}/1080/1080.jpg`, { redirect: 'follow' });
  if (!r.ok) throw new Error(`image download failed (${r.status})`);
  return new Uint8Array(await r.arrayBuffer());
}

console.log('Creating users…');
const users = [];
for (const u of USERS) {
  const { client, id } = await signInOrUp(u);
  must(
    await client.from('profiles').update({ bio: u.bio, full_name: u.full_name, is_private: !!u.is_private }).eq('id', id),
    `update profile ${u.username}`,
  );
  users.push({ ...u, client, id });
  console.log(`  ✓ ${u.username}`);
}

console.log('Following…');
for (const a of users)
  for (const b of users) {
    if (a.id === b.id) continue;
    const res = await a.client.from('follows').insert({ follower_id: a.id, following_id: b.id });
    if (res.error && res.error.code !== '23505') throw new Error(`follow: ${res.error.message}`);
  }
// private users approve only the first two other users
for (const priv of users.filter((u) => u.is_private)) {
  const approved = users.filter((u) => u.id !== priv.id).slice(0, 2).map((u) => u.id);
  must(
    await priv.client.from('follows').update({ status: 'accepted' }).eq('following_id', priv.id).in('follower_id', approved),
    'accept follow',
  );
}

console.log('Posting…');
for (const u of users) {
  const existing = await u.client.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', u.id);
  if ((existing.count ?? 0) > 0) {
    console.log(`  - ${u.username} already has posts, skipping`);
    continue;
  }
  for (let p = 0; p < 3; p++) {
    const postId = randomUUID();
    const withLocation = p < 2;
    // small jitter around the city so the map tab has distinct pins
    const lng = u.city[1] + (Math.random() - 0.5) * 0.08;
    const lat = u.city[2] + (Math.random() - 0.5) * 0.08;
    must(
      await u.client.from('posts').insert({
        id: postId,
        author_id: u.id,
        description: pick(CAPTIONS),
        location_name: withLocation ? u.city[0] : null,
        location: withLocation ? `SRID=4326;POINT(${lng} ${lat})` : null,
        created_at: new Date(Date.now() - Math.random() * 7 * 864e5).toISOString(),
      }),
      'insert post',
    );
    const slides = 1 + ((p + u.username.length) % 3); // 1–3 images → carousel
    for (let i = 0; i < slides; i++) {
      const path = `${u.id}/${postId}/${i}.jpg`;
      const bytes = await fetchImage(`${u.username}-${p}-${i}`);
      must(await u.client.storage.from('posts').upload(path, bytes, { contentType: 'image/jpeg' }), 'upload');
      must(
        await u.client.from('post_media').insert({
          post_id: postId, storage_path: path, media_type: 'image', width: 1080, height: 1080, position: i,
        }),
        'insert media',
      );
    }
    console.log(`  ✓ ${u.username} post ${p + 1} (${slides} image${slides > 1 ? 's' : ''})`);
  }
}

console.log('Likes & comments…');
for (const u of users) {
  const already = await u.client.from('likes').select('post_id', { count: 'exact', head: true }).eq('user_id', u.id);
  if ((already.count ?? 0) > 0) continue;
  const visible = must(await u.client.from('posts').select('id, author_id').is('deleted_at', null), 'list posts')
    .filter((p) => p.author_id !== u.id);
  for (const post of visible) {
    if (Math.random() < 0.7) {
      must(await u.client.from('likes').insert({ post_id: post.id, user_id: u.id }), 'like');
    }
    if (Math.random() < 0.35) {
      must(await u.client.from('comments').insert({ post_id: post.id, author_id: u.id, body: pick(COMMENTS) }), 'comment');
    }
  }
}

console.log(`\nDone. Log into the app with e.g. annatravels@seed.example.com / ${PASSWORD}`);
console.log('(emails: username without . or _ + @seed.example.com)');
