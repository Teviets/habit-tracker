import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '../components/AppText';
import { AuthenticationGate } from '../components/AuthenticationGate';
import { UserSearchModal } from '../components/UserSearchModal';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { Locale } from '../i18n/translations';
import { useAppTheme } from '../theme/ThemeProvider';
import { ThemeMode } from '../theme/tokens';

export function ProfileScreen() {
  const { colors, mode, setMode, radius, spacing } = useAppTheme();
  const { t, locale, setLocale } = useI18n();
  const { isAuthenticated, signOut, user, accessToken } = useAuth();
  const [reminders, setReminders] = useState(true);
  const [searchVisible, setSearchVisible] = useState(false);

  if (!isAuthenticated) {
    return <Screen><AuthenticationGate messageKey="auth.requiredProfile" icon="person-circle-outline" /></Screen>;
  }

  return (
    <Screen>
      <View style={[styles.hero, { marginTop: spacing.md }]}> 
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}> 
          <AppText variant="title" weight="800" color={colors.primary}>{user?.displayName.slice(0, 1).toUpperCase()}</AppText>
          <View style={[styles.avatarBadge, { backgroundColor: colors.accent, borderColor: colors.background }]}> 
            <Ionicons name="leaf" size={13} color={colors.white} />
          </View>
        </View>
        <AppText variant="title" weight="800" style={{ marginTop: spacing.md }}>{user?.displayName ?? t('profile.title')}</AppText>
        <AppText color={colors.textSecondary}>{t('profile.subtitle')}</AppText>
        <View style={[styles.level, { backgroundColor: colors.lavenderSoft, marginTop: spacing.md }]}> 
          <Ionicons name="sparkles" size={15} color={colors.lavender} />
          <AppText variant="caption" weight="700" color={colors.lavender}>{t('profile.level')}</AppText>
        </View>
      </View>

      <AppText variant="heading" weight="700" style={{ marginTop: spacing.xxl, marginBottom: spacing.md }}>{t('profile.preferences')}</AppText>
      <View style={[styles.settingsCard, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.lg }]}> 
        <SettingTitle icon="contrast-outline" title={t('profile.appearance')} />
        <SegmentedControl
          value={mode}
          onChange={(value) => setMode(value as ThemeMode)}
          options={[
            { value: 'system', label: t('profile.system'), icon: 'phone-portrait-outline' },
            { value: 'light', label: t('profile.light'), icon: 'sunny-outline' },
            { value: 'dark', label: t('profile.dark'), icon: 'moon-outline' },
          ]}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <SettingTitle icon="language-outline" title={t('profile.language')} />
        <SegmentedControl
          value={locale}
          onChange={(value) => setLocale(value as Locale)}
          options={[
            { value: 'es', label: 'Español' },
            { value: 'en', label: 'English' },
          ]}
        />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.settingRow}>
          <View style={[styles.settingIcon, { backgroundColor: colors.accentSoft }]}> 
            <Ionicons name="notifications-outline" size={20} color={colors.accent} />
          </View>
          <View style={styles.settingCopy}>
            <AppText weight="700">{t('profile.notifications')}</AppText>
            <AppText variant="caption" color={colors.textSecondary}>{t('profile.notificationsHint')}</AppText>
          </View>
          <Switch
            value={reminders}
            onValueChange={setReminders}
            trackColor={{ false: colors.surfaceMuted, true: colors.primary }}
            thumbColor={colors.white}
          />
        </View>
      </View>

      <View style={[styles.linksCard, { backgroundColor: colors.surface, borderRadius: radius.xl, marginTop: spacing.xl }]}> 
        <LinkRow icon="people-outline" label="Buscar personas" onPress={() => setSearchVisible(true)} />
        <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />
        <LinkRow icon="shield-checkmark-outline" label={t('profile.account')} />
        <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />
        <LinkRow icon="help-circle-outline" label={t('profile.help')} />
        <View style={[styles.linkDivider, { backgroundColor: colors.border }]} />
        <LinkRow icon="log-out-outline" label={t('auth.logout')} destructive onPress={() => void signOut()} />
      </View>

      <AppText variant="caption" color={colors.textSecondary} style={[styles.version, { marginTop: spacing.xl }]}>{t('profile.version')}</AppText>
      {accessToken ? <UserSearchModal visible={searchVisible} token={accessToken} onClose={() => setSearchVisible(false)} /> : null}
    </Screen>
  );
}

function SettingTitle({ icon, title }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.settingTitle}>
      <Ionicons name={icon} size={19} color={colors.primary} />
      <AppText variant="small" weight="700">{title}</AppText>
    </View>
  );
}

type SegmentOption = { value: string; label: string; icon?: React.ComponentProps<typeof Ionicons>['name'] };

function SegmentedControl({ value, options, onChange }: { value: string; options: SegmentOption[]; onChange: (value: string) => void }) {
  const { colors, radius } = useAppTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.surfaceMuted, borderRadius: radius.md }]}> 
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [
              styles.segmentItem,
              { backgroundColor: selected ? colors.surfaceRaised : 'transparent', borderRadius: radius.sm, opacity: pressed ? 0.75 : 1 },
            ]}
          >
            {option.icon ? <Ionicons name={option.icon} size={16} color={selected ? colors.primary : colors.textSecondary} /> : null}
            <AppText variant="caption" weight="700" color={selected ? colors.primary : colors.textSecondary}>{option.label}</AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function LinkRow({ icon, label, destructive = false, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; destructive?: boolean; onPress?: () => void }) {
  const { colors, spacing } = useAppTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.linkRow, { padding: spacing.lg, opacity: pressed ? 0.65 : 1 }]}> 
      <Ionicons name={icon} size={21} color={destructive ? colors.danger : colors.primary} />
      <AppText weight="600" color={destructive ? colors.danger : undefined} style={styles.settingCopy}>{label}</AppText>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center' },
  avatar: { width: 84, height: 84, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  avatarBadge: { position: 'absolute', right: -3, bottom: -3, width: 28, height: 28, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  level: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  settingsCard: {},
  settingTitle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 18 },
  segment: { flexDirection: 'row', padding: 4, gap: 3 },
  segmentItem: { flex: 1, minHeight: 40, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  settingRow: { flexDirection: 'row', alignItems: 'center' },
  settingIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  settingCopy: { flex: 1, marginHorizontal: 12 },
  linksCard: { overflow: 'hidden' },
  linkRow: { flexDirection: 'row', alignItems: 'center' },
  linkDivider: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  version: { textAlign: 'center' },
});
