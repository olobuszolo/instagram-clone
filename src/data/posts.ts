export type Post = {
  id: string;
  user: string;
  caption: string;
  likes: number;
};

export const posts: Post[] = Array.from({ length: 10 }, (_, i) => ({
  id: String(i + 1),
  user: `user_${i + 1}`,
  caption: `Placeholder caption for post ${i + 1}`,
  likes: (i + 1) * 12,
}));
