import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { AuthModal } from './AuthModal';

type Props = { messageKey: 'auth.requiredStats' | 'auth.requiredProfile' | 'auth.requiredChat'; icon?: React.ComponentProps<typeof Ionicons>['name'] };

export function AuthenticationGate({ messageKey, icon = 'lock-closed-outline' }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');

  const open = (nextMode: 'login' | 'register') => {
    setMode(nextMode);
    setVisible(true);
  };

  return (
    <>
      <View style={[styles.wrap, { paddingTop: spacing.xxxl }]}> 
        <View style={[styles.icon, { backgroundColor: colors.primarySoft, borderRadius: radius.lg }]}>
          <Ionicons name={icon} size={30} color={colors.primary} />
        </View>
        <AppText variant="title" weight="800" style={styles.title}>{t('auth.requiredTitle')}</AppText>
        <AppText color={colors.textSecondary} style={styles.copy}>{t(messageKey)}</AppText>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => open('login')} style={({ pressed }) => [styles.login, { borderColor: colors.primary, borderRadius: radius.full, opacity: pressed ? 0.78 : 1 }]}>
            <AppText weight="800" color={colors.primary}>{t('auth.login')}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => open('register')} style={({ pressed }) => [styles.register, { backgroundColor: colors.primary, borderRadius: radius.full, opacity: pressed ? 0.78 : 1 }]}>
            <AppText weight="800" color={colors.white}>{t('auth.register')}</AppText>
          </Pressable>
        </View>
      </View>
      <AuthModal visible={visible} initialMode={mode} onClose={() => setVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 20 },
  icon: { alignItems: 'center', height: 72, justifyContent: 'center', width: 72 },
  title: { marginTop: 20, textAlign: 'center' },
  copy: { marginTop: 10, maxWidth: 360, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24, width: '100%' },
  login: { alignItems: 'center', borderWidth: 1, flex: 1, minHeight: 50, justifyContent: 'center' },
  register: { alignItems: 'center', flex: 1.2, justifyContent: 'center', minHeight: 50 },
});
