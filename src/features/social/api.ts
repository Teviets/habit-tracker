import { apiRequest } from '../../config/api';

export type PublicUser = { id: string; username: string; displayName: string; avatarUrl: string | null; bio?: string | null; isFollowing?: boolean };
export type SocialPost = {
  id: string; content: string; kind: 'update' | 'milestone' | 'tip'; privacy: 'private' | 'group' | 'public'; habitId: string | null; streakValue: number | null;
  likes: number; comments: number; likedByViewer: boolean; createdAt: string; author: PublicUser;
};
export type Comment = { id: string; content: string; createdAt: string; author: PublicUser };

function auth<T>(token: string, path: string, init: RequestInit = {}) { return apiRequest<T>(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${token}` } }); }
export const socialApi = {
  feed: (token: string) => auth<SocialPost[]>(token, '/posts?limit=30'),
  createPost: (token: string, content: string, habitId: string) => auth<SocialPost>(token, '/posts', { method: 'POST', body: JSON.stringify({ content, habitId, privacy: 'public' }) }),
  like: (token: string, postId: string) => auth<{ liked: boolean }>(token, `/posts/${postId}/like`, { method: 'PUT' }),
  unlike: (token: string, postId: string) => auth<void>(token, `/posts/${postId}/like`, { method: 'DELETE' }),
  comments: (token: string, postId: string) => auth<Comment[]>(token, `/posts/${postId}/comments`),
  comment: (token: string, postId: string, content: string) => auth<Comment>(token, `/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  searchUsers: (token: string, query: string) => auth<PublicUser[]>(token, `/users?query=${encodeURIComponent(query)}`),
  profile: (token: string, id: string) => auth<PublicUser & { followers: number; following: number; publicHabits: { id: string; name: string }[] }>(token, `/users/${id}`),
  follow: (token: string, id: string) => auth<{ following: boolean }>(token, `/users/${id}/follow`, { method: 'PUT' }),
  unfollow: (token: string, id: string) => auth<void>(token, `/users/${id}/follow`, { method: 'DELETE' }),
};
