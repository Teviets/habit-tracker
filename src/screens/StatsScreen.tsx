import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { AppText } from '../components/AppText';
import { AuthenticationGate } from '../components/AuthenticationGate';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthProvider';
import { StatsOverview, habitApi } from '../features/habits/api';
import { SectionHeader } from '../components/SectionHeader';
import { useI18n } from '../i18n/I18nProvider';
import { TranslationKey } from '../i18n/translations';
import { useAppTheme } from '../theme/ThemeProvider';

const WEEK = [0, 0, 0, 0, 0, 0, 0];

export function StatsScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { t } = useI18n();
  const { isAuthenticated, accessToken } = useAuth();
  const { width } = useWindowDimensions();
  const isWide = width >= 700;
  const dayKeys: TranslationKey[] = ['day.mon', 'day.tue', 'day.wed', 'day.thu', 'day.fri', 'day.sat', 'day.sun'];
  const [overview, setOverview] = useState<StatsOverview | null>(null);
  useFocusEffect(useCallback(() => {
    if (!accessToken) return;
    habitApi.overview(accessToken).then(setOverview).catch(() => setOverview(null));
  }, [accessToken]));

  if (!isAuthenticated) {
    return <Screen><AuthenticationGate messageKey="auth.requiredStats" icon="stats-chart-outline" /></Screen>;
  }

  return (
    <Screen>
      <View style={{ marginTop: spacing.md }}>
        <AppText variant="caption" weight="800" color={colors.primary} style={styles.eyebrow}>{t('stats.eyebrow')}</AppText>
        <AppText variant="hero" weight="800">{t('stats.title')}</AppText>
        <AppText color={colors.textSecondary} style={{ marginTop: spacing.xs }}>{t('stats.subtitle')}</AppText>
      </View>

      <View style={[styles.statGrid, { marginTop: spacing.xxl }]}> 
        <Metric label={t('stats.rate')} value={`${overview?.completionRate ?? 0}%`} icon="trending-up" color={colors.primary} wide={isWide} />
        <Metric label={t('stats.completed')} value={String(overview?.totalCompleted ?? 0)} icon="checkmark-done" color={colors.lavender} wide={isWide} />
        <Metric label={t('stats.bestStreak')} value={`${overview?.habits.bestEverStreak ?? 0} ${t('stats.days')}`} icon="flame" color={colors.accent} wide={isWide} />
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl }]}> 
        <SectionHeader title={t('stats.weekly')} action={t('common.week')} />
        <View style={styles.chart}>
          {WEEK.map((_, index) => {
            const date = new Date(); date.setDate(date.getDate() - (6 - index));
            const key = date.toLocaleDateString('en-CA');
            const day = overview?.lastSevenDays.find((item) => item.occurredOn === key);
            const value = day?.total ? day.completed / day.total : 0;
            return (
            <View key={`${value}-${index}`} style={styles.barColumn}>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}> 
                <View style={[styles.bar, { height: `${Math.round(value * 100)}%`, backgroundColor: index === 3 ? colors.accent : colors.primary }]} />
              </View>
              <AppText variant="caption" color={colors.textSecondary}>{t(dayKeys[index])}</AppText>
            </View>
          );})}
        </View>
      </View>

      <View style={[styles.detailCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xl }]}> 
        <SectionHeader title={t('stats.consistency')} />
        {overview?.byHabit.map((habit) => (
          <View key={habit.id} style={styles.habitStat}>
            <View style={styles.habitStatTop}>
              <AppText variant="small" weight="600">{habit.name}</AppText>
              <AppText variant="small" weight="700" color={habit.color}>{habit.completionRate}%</AppText>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}> 
              <View style={[styles.progressFill, { backgroundColor: habit.color, width: `${habit.completionRate}%` }]} />
            </View>
          </View>
        ))}
      </View>

      <View style={[styles.insight, { backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.lg, marginTop: spacing.xl }]}> 
        <View style={[styles.insightIcon, { backgroundColor: colors.primary }]}> 
          <Ionicons name="bulb-outline" size={22} color={colors.white} />
        </View>
        <View style={styles.insightCopy}>
          <AppText weight="700">{t('stats.insightTitle')}</AppText>
          <AppText variant="small" color={colors.textSecondary}>{t('stats.insightBody')}</AppText>
        </View>
      </View>
    </Screen>
  );
}

function Metric({ label, value, icon, color, wide }: { label: string; value: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string; wide: boolean }) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg }, wide && styles.metricWide]}> 
      <Ionicons name={icon} size={22} color={color} />
      <AppText variant="heading" weight="800" style={styles.metricValue}>{value}</AppText>
      <AppText variant="caption" color={colors.textSecondary}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { letterSpacing: 1.4, marginBottom: 4 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { minWidth: 104, flexGrow: 1, flexBasis: '30%' },
  metricWide: { minHeight: 120 },
  metricValue: { marginTop: 14 },
  chartCard: {},
  chart: { height: 180, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  barColumn: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end', gap: 8 },
  barTrack: { flex: 1, width: '66%', minWidth: 18, maxWidth: 36, borderRadius: 999, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 999 },
  detailCard: {},
  habitStat: { marginBottom: 18 },
  habitStatTop: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressTrack: { height: 9, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  insight: { flexDirection: 'row', alignItems: 'flex-start' },
  insightIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  insightCopy: { flex: 1, marginLeft: 13, gap: 2 },
});
