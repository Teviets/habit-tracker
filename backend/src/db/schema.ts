import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const habitFrequency = pgEnum('habit_frequency', ['daily', 'weekly', 'custom']);
export const habitStatus = pgEnum('habit_status', ['active', 'paused', 'archived']);
export const visibility = pgEnum('visibility', ['private', 'group', 'public']);
export const postKind = pgEnum('post_kind', ['update', 'milestone', 'tip']);
export const groupRole = pgEnum('group_role', ['owner', 'admin', 'member']);
export const conversationKind = pgEnum('conversation_kind', ['direct', 'group']);

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull(),
  username: varchar('username', { length: 40 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  displayName: varchar('display_name', { length: 100 }).notNull(),
  bio: varchar('bio', { length: 280 }),
  avatarUrl: text('avatar_url'),
  timezone: varchar('timezone', { length: 80 }).notNull().default('UTC'),
  locale: varchar('locale', { length: 10 }).notNull().default('es'),
  theme: varchar('theme', { length: 10 }).notNull().default('system'),
  isPremium: boolean('is_premium').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  uniqueIndex('users_email_unique').on(sql`lower(${table.email})`),
  uniqueIndex('users_username_unique').on(sql`lower(${table.username})`),
]);

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  refreshTokenHash: varchar('refresh_token_hash', { length: 64 }).notNull().unique(),
  userAgent: varchar('user_agent', { length: 500 }),
  ipAddress: varchar('ip_address', { length: 64 }),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [index('sessions_user_id_idx').on(table.userId), index('sessions_expires_at_idx').on(table.expiresAt)]);

export const habitGroups = pgTable('habit_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 9 }).notNull().default('#2E8067'),
  icon: varchar('icon', { length: 50 }).notNull().default('folder-outline'),
  ...timestamps,
}, (table) => [index('habit_groups_user_idx').on(table.userId)]);

export const habits = pgTable('habits', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  habitGroupId: uuid('habit_group_id').references(() => habitGroups.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 120 }).notNull(),
  description: varchar('description', { length: 500 }),
  icon: varchar('icon', { length: 50 }).notNull().default('leaf-outline'),
  color: varchar('color', { length: 9 }).notNull().default('#2E8067'),
  frequency: habitFrequency('frequency').notNull().default('daily'),
  daysOfWeek: integer('days_of_week').array().notNull().default(sql`ARRAY[1,2,3,4,5,6,7]::integer[]`),
  targetCount: integer('target_count').notNull().default(1),
  unit: varchar('unit', { length: 40 }).notNull().default('veces'),
  reminderTime: time('reminder_time'),
  startDate: date('start_date').notNull().defaultNow(),
  status: habitStatus('status').notNull().default('active'),
  privacy: visibility('privacy').notNull().default('private'),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  ...timestamps,
}, (table) => [
  index('habits_user_status_idx').on(table.userId, table.status),
  check('habits_target_count_positive', sql`${table.targetCount} > 0`),
]);

export const habitEntries = pgTable('habit_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  habitId: uuid('habit_id').notNull().references(() => habits.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  occurredOn: date('occurred_on').notNull(),
  value: integer('value').notNull().default(1),
  completed: boolean('completed').notNull().default(true),
  note: varchar('note', { length: 500 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex('habit_entries_habit_day_unique').on(table.habitId, table.occurredOn),
  index('habit_entries_user_day_idx').on(table.userId, table.occurredOn),
  check('habit_entries_value_nonnegative', sql`${table.value} >= 0`),
]);

export const groups = pgTable('groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  name: varchar('name', { length: 100 }).notNull(),
  description: varchar('description', { length: 500 }),
  avatarUrl: text('avatar_url'),
  isPrivate: boolean('is_private').notNull().default(false),
  joinCode: varchar('join_code', { length: 16 }),
  ...timestamps,
}, (table) => [index('groups_owner_id_idx').on(table.ownerId), uniqueIndex('groups_join_code_unique').on(table.joinCode)]);

export const groupMembers = pgTable('group_members', {
  groupId: uuid('group_id').notNull().references(() => groups.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: groupRole('role').notNull().default('member'),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.groupId, table.userId] }),
  index('group_members_user_id_idx').on(table.userId),
]);

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  habitId: uuid('habit_id').references(() => habits.id, { onDelete: 'set null' }),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 2000 }).notNull(),
  kind: postKind('kind').notNull().default('update'),
  privacy: visibility('privacy').notNull().default('public'),
  streakValue: integer('streak_value'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [
  index('posts_feed_idx').on(table.createdAt),
  index('posts_author_idx').on(table.authorId, table.createdAt),
  index('posts_group_idx').on(table.groupId, table.createdAt),
]);

export const follows = pgTable('follows', {
  followerId: uuid('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: uuid('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.followerId, table.followingId] }),
  index('follows_following_idx').on(table.followingId),
  check('follows_no_self_follow', sql`${table.followerId} <> ${table.followingId}`),
]);

export const postLikes = pgTable('post_likes', {
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.postId, table.userId] }), index('post_likes_user_idx').on(table.userId)]);

export const postComments = pgTable('post_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  postId: uuid('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: varchar('content', { length: 1000 }).notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
  ...timestamps,
}, (table) => [index('post_comments_post_idx').on(table.postId, table.createdAt)]);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: conversationKind('kind').notNull().default('direct'),
  groupId: uuid('group_id').references(() => groups.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }),
  ...timestamps,
}, (table) => [index('conversations_group_idx').on(table.groupId)]);

export const conversationMembers = pgTable('conversation_members', {
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  lastReadAt: timestamp('last_read_at', { withTimezone: true }),
  joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.conversationId, table.userId] }),
  index('conversation_members_user_idx').on(table.userId),
]);

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').notNull().references(() => conversations.id, { onDelete: 'cascade' }),
  senderId: uuid('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  clientId: uuid('client_id'),
  content: varchar('content', { length: 4000 }).notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  editedAt: timestamp('edited_at', { withTimezone: true }),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => [
  index('messages_conversation_created_idx').on(table.conversationId, table.createdAt),
  uniqueIndex('messages_client_id_unique').on(table.conversationId, table.clientId),
]);

export type User = typeof users.$inferSelect;
export type Habit = typeof habits.$inferSelect;
export type HabitGroup = typeof habitGroups.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Follow = typeof follows.$inferSelect;
export type Group = typeof groups.$inferSelect;
export type Message = typeof messages.$inferSelect;
