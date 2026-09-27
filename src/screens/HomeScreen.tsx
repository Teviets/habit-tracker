import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';

import { AppText } from '../components/AppText';
import { useAuth } from '../auth/AuthProvider';
import { Habit, habitApi } from '../features/habits/api';
import { Comment, SocialPost, socialApi } from '../features/social/api';
import { ProgressRing } from '../components/ProgressRing';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from '../types/navigation';

const today = () => new Date().toLocaleDateString('en-CA');

export function HomeScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { t, localeTag } = useI18n();
  const { isAuthenticated, accessToken } = useAuth();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isWide = width >= 700;
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [postText, setPostText] = useState('');
  const [composerVisible, setComposerVisible] = useState(false);
  const [commentPost, setCommentPost] = useState<SocialPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const date = useMemo(() => new Intl.DateTimeFormat(localeTag, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date()), [localeTag]);

  const loadHabits = useCallback(async () => {
    if (!accessToken) { setHabits([]); setCompleted(new Set()); return; }
    try {
      const items = await habitApi.list(accessToken);
      const entries = await Promise.all(items.map(async (habit) => ({ id: habit.id, items: await habitApi.checkIns(accessToken, habit.id, today()) })));
      setHabits(items);
      setCompleted(new Set(entries.filter((entry) => entry.items[0]?.completed).map((entry) => entry.id)));
    } catch { setHabits([]); setCompleted(new Set()); }
  }, [accessToken]);
  const loadFeed = useCallback(async () => { if (!accessToken) { setPosts([]); return; } try { setPosts(await socialApi.feed(accessToken)); } catch { setPosts([]); } }, [accessToken]);
  useFocusEffect(useCallback(() => { void loadHabits(); void loadFeed(); }, [loadHabits, loadFeed]));

  const toggleHabit = async (habit: Habit) => {
    if (!accessToken) return;
    const nextValue = !completed.has(habit.id);
    setCompleted((current) => { const next = new Set(current); nextValue ? next.add(habit.id) : next.delete(habit.id); return next; });
    try {
      const result = await habitApi.checkIn(accessToken, habit.id, nextValue, today());
      setHabits((current) => current.map((item) => item.id === habit.id ? { ...item, currentStreak: result.streak } : item));
    } catch { void loadHabits(); }
  };

  const publishPost = async () => {
    if (!isAuthenticated || !accessToken || !habits.length) return;
    const content = postText.trim();
    if (!content) return;
    try { const post = await socialApi.createPost(accessToken, content, habits[0].id); setPosts((current) => [post, ...current]); setPostText(''); setComposerVisible(false); } catch { /* The composer remains open so the user can retry. */ }
  };

  const toggleLike = async (post: SocialPost) => {
    if (!accessToken) return;
    const liked = !post.likedByViewer;
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, likedByViewer: liked, likes: item.likes + (liked ? 1 : -1) } : item));
    try { liked ? await socialApi.like(accessToken, post.id) : await socialApi.unlike(accessToken, post.id); } catch { void loadFeed(); }
  };
  const openComments = async (post: SocialPost) => {
    setCommentPost(post); setCommentText('');
    if (!accessToken) return;
    try { setComments(await socialApi.comments(accessToken, post.id)); } catch { setComments([]); }
  };
  const addComment = async () => {
    if (!accessToken || !commentPost || !commentText.trim()) return;
    try {
      const comment = await socialApi.comment(accessToken, commentPost.id, commentText.trim());
      setComments((current) => [...current, comment]); setCommentText('');
      setPosts((current) => current.map((post) => post.id === commentPost.id ? { ...post, comments: post.comments + 1 } : post));
    } catch { /* Keep the typed comment visible for a retry. */ }
  };

  return (
    <Screen>
      <View style={[styles.top, { marginTop: spacing.md, marginBottom: spacing.xl }]}> 
        <View style={styles.titleBlock}>
          <AppText variant="small" weight="700" color={colors.primary} style={styles.date}>{date.toLocaleUpperCase()}</AppText>
          <AppText variant="title" weight="800">{t('home.greeting')}</AppText>
          <AppText color={colors.textSecondary}>{t('home.subtitle')}</AppText>
        </View>
        {isAuthenticated ? (
          <View style={styles.headerActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('nav.chat')}
                onPress={() => navigation.navigate('Chat')}
                style={({ pressed }) => [styles.postButton, { backgroundColor: colors.primarySoft, opacity: pressed ? 0.78 : 1 }]}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.primary} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.createPost')}
                onPress={() => setComposerVisible(true)}
                style={({ pressed }) => [styles.postButton, { backgroundColor: colors.primary, opacity: pressed ? 0.82 : 1 }]}
              >
                <Ionicons name="create-outline" size={21} color={colors.white} />
              </Pressable>
          </View>
        ) : null}
      </View>

      <View style={[styles.dashboard, isWide && styles.dashboardWide]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.section')}
          onPress={() => navigation.navigate('Habits' as never)}
          style={[
          styles.progressCard,
          {
            backgroundColor: colors.primaryStrong,
            borderRadius: radius.xl,
            padding: spacing.xl,
          },
          isWide && styles.wideCard,
        ]}>
          <View style={styles.progressCopy}>
            <AppText weight="700" color={colors.white}>{t('home.progressTitle')}</AppText>
            <AppText variant="small" color="rgba(255,255,255,0.72)" style={styles.progressLabel}>
              {t('home.progressLabel', { done: completed.size, total: habits.length })}
            </AppText>
            <View style={styles.softBadge}>
              <Ionicons name="sparkles" size={14} color="#173F35" />
              <AppText variant="caption" weight="700" color="#173F35">+15 pts</AppText>
            </View>
          </View>
          <ProgressRing progress={habits.length ? completed.size / habits.length : 0} size={104} label={t('common.today')} />
        </Pressable>

        <View style={[
          styles.streakCard,
          { backgroundColor: colors.accentSoft, borderRadius: radius.xl, padding: spacing.xl },
          isWide && styles.streakWide,
        ]}>
          <View style={[styles.streakIcon, { backgroundColor: colors.accent }]}> 
            <Ionicons name="flame" size={23} color={colors.white} />
          </View>
          <View style={styles.streakCopy}>
            <AppText variant="small" color={colors.textSecondary}>{t('home.streak')}</AppText>
            <AppText variant="heading" weight="800">{Math.max(0, ...habits.map((habit) => habit.currentStreak))} {t('stats.days')}</AppText>
          </View>
          <Ionicons name="trending-up" size={24} color={colors.accent} />
        </View>
      </View>

      <View style={{ marginTop: spacing.xxl }}>
        <SectionHeader title={t('home.community')} />
        <View style={styles.feed}>
          {posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={() => void toggleLike(post)} onComment={() => void openComments(post)} />
          ))}
        </View>
      </View>

      <View style={[styles.quote, { backgroundColor: colors.lavenderSoft, borderRadius: radius.lg, marginTop: spacing.lg, padding: spacing.lg }]}> 
        <Ionicons name="flower-outline" size={24} color={colors.lavender} />
        <AppText variant="small" weight="600" style={styles.quoteText}>{t('home.motivation')}</AppText>
      </View>

      <Modal
        animationType="slide"
        transparent
        visible={composerVisible && isAuthenticated}
        onRequestClose={() => setComposerVisible(false)}
      >
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <Pressable style={styles.modalBackdrop} onPress={() => setComposerVisible(false)} />
          <View style={[styles.composerSheet, { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl }]}>
            <View style={styles.composerHeader}>
              <AppText variant="heading" weight="800">{t('home.createPostTitle')}</AppText>
              <Pressable accessibilityRole="button" accessibilityLabel={t('home.cancel')} onPress={() => setComposerVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={t('home.createPostHint')}
              autoFocus
              multiline
              maxLength={500}
              placeholder={t('home.createPostHint')}
              placeholderTextColor={colors.textSecondary}
              value={postText}
              onChangeText={setPostText}
              style={[styles.postInput, { color: colors.text, backgroundColor: colors.surfaceMuted, borderRadius: radius.lg }]}
              textAlignVertical="top"
            />
            <View style={styles.composerFooter}>
              <AppText variant="caption" color={colors.textSecondary}>{postText.length}/500</AppText>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.publish')}
                disabled={!postText.trim()}
                onPress={publishPost}
                style={({ pressed }) => [styles.publishButton, { backgroundColor: postText.trim() ? colors.primary : colors.surfaceMuted, opacity: pressed ? 0.8 : 1, borderRadius: radius.full }]}
              >
                <Ionicons name="send" size={16} color={postText.trim() ? colors.white : colors.textSecondary} />
                <AppText variant="small" weight="700" color={postText.trim() ? colors.white : colors.textSecondary}>{t('home.publish')}</AppText>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal transparent animationType="slide" visible={Boolean(commentPost)} onRequestClose={() => setCommentPost(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <Pressable style={styles.modalBackdrop} onPress={() => setCommentPost(null)} />
          <View style={[styles.composerSheet, { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl }]}>
            <View style={styles.composerHeader}><AppText variant="heading" weight="800">{t('home.comments', { count: comments.length })}</AppText><Pressable onPress={() => setCommentPost(null)}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable></View>
            {comments.map((comment) => <View key={comment.id} style={[styles.commentRow, { borderBottomColor: colors.border }]}><AppText weight="700">{comment.author.displayName}</AppText><AppText variant="small">{comment.content}</AppText></View>)}
            <View style={styles.commentComposer}><TextInput value={commentText} onChangeText={setCommentText} placeholder={t('home.comment')} placeholderTextColor={colors.textSecondary} style={[styles.commentInput, { color: colors.text, borderColor: colors.border, borderRadius: radius.md }]} /><Pressable onPress={() => void addComment()}><Ionicons name="send" size={22} color={colors.primary} /></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

function PostCard({ post, onLike, onComment }: { post: SocialPost; onLike: () => void; onComment: () => void }) {
  const { colors, radius, spacing } = useAppTheme();
  const { t } = useI18n();

  return (
    <View style={[styles.postCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg }]}>
      <View style={styles.postHeader}>
        <View style={[styles.postAvatar, { backgroundColor: colors.primary }]}> 
          <AppText variant="caption" weight="800" color={colors.white}>{post.author.displayName.slice(0, 2).toUpperCase()}</AppText>
        </View>
        <View style={styles.postAuthor}>
          <AppText weight="800">{post.author.displayName}</AppText>
          <AppText variant="caption" color={colors.textSecondary}>@{post.author.username}</AppText>
        </View>
        <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
      </View>
      <AppText style={styles.postContent}>{post.content}</AppText>
      <View style={[styles.postStats, { borderTopColor: colors.border }]}>
        <AppText variant="caption" color={colors.textSecondary}>{t('home.likes', { count: post.likes })}</AppText>
        <AppText variant="caption" color={colors.textSecondary}>{t('home.comments', { count: post.comments })}</AppText>
      </View>
      <View style={styles.postActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.like')} onPress={onLike} style={styles.postAction}>
          <Ionicons name={post.likedByViewer ? 'heart' : 'heart-outline'} size={20} color={post.likedByViewer ? colors.accent : colors.textSecondary} />
          <AppText variant="small" weight="700" color={post.likedByViewer ? colors.accent : colors.textSecondary}>{t('home.like')}</AppText>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t('home.comment')} onPress={onComment} style={styles.postAction}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.textSecondary} />
          <AppText variant="small" weight="700" color={colors.textSecondary}>{t('home.comment')}</AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center' },
  titleBlock: { flex: 1 },
  date: { letterSpacing: 1, marginBottom: 3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 12, gap: 8 },
  postButton: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dashboard: { gap: 12 },
  dashboardWide: { flexDirection: 'row' },
  progressCard: { minHeight: 168, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  wideCard: { flex: 1.4 },
  progressCopy: { flex: 1, paddingRight: 8 },
  progressLabel: { marginTop: 5, marginBottom: 18 },
  softBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#DFF4E9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  streakCard: { flexDirection: 'row', alignItems: 'center', minHeight: 92 },
  streakWide: { flex: 0.8, minHeight: 168 },
  streakIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  streakCopy: { flex: 1, marginHorizontal: 13 },
  feed: { gap: 12 },
  postCard: { borderWidth: 1 },
  postHeader: { flexDirection: 'row', alignItems: 'center' },
  postAvatar: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  postAuthor: { flex: 1, marginLeft: 11 },
  postContent: { marginTop: 14 },
  postStats: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, marginTop: 15, paddingTop: 11 },
  postActions: { flexDirection: 'row', marginTop: 11, gap: 24 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 3 },
  quote: { flexDirection: 'row', alignItems: 'center' },
  quoteText: { flex: 1, marginLeft: 12 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.28)' },
  modalBackdrop: { ...StyleSheet.absoluteFill },
  composerSheet: { borderTopWidth: 1, paddingBottom: 36 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  postInput: { minHeight: 140, marginTop: 20, fontSize: 16, lineHeight: 23, padding: 15 },
  composerFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  publishButton: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 17, paddingVertical: 11 },
  commentRow: { gap: 3, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14 },
  commentInput: { flex: 1, minHeight: 46, borderWidth: 1, paddingHorizontal: 12 },
});
