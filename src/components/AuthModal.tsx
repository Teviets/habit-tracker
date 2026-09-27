import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, LayoutChangeEvent, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ApiError } from '../config/api';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Mode = 'login' | 'register';

type Props = {
  visible: boolean;
  initialMode?: Mode;
  onClose: () => void;
};

export function AuthModal({ visible, initialMode = 'login', onClose }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  const { t, locale } = useI18n();
  const { signIn, register } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formScrollRef = useRef<ScrollView>(null);
  const fieldPositions = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!visible) return;
    setMode(initialMode);
    setError(null);
  }, [visible, initialMode]);

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setError(null);
  };

  const rememberFieldPosition = (field: string) => (event: LayoutChangeEvent) => {
    fieldPositions.current[field] = event.nativeEvent.layout.y;
  };

  const revealField = (field: string) => () => {
    formScrollRef.current?.scrollTo({
      y: Math.max(0, (fieldPositions.current[field] ?? 0) - 16),
      animated: true,
    });
  };

  const authErrorMessage = (cause: unknown) => {
    if (!(cause instanceof ApiError)) return t('auth.genericError');

    const messages = {
      USER_NOT_FOUND: 'auth.userNotFound',
      INVALID_PASSWORD: 'auth.invalidPassword',
      ACCOUNT_BLOCKED: 'auth.accountBlocked',
      ACCOUNT_EXISTS: 'auth.accountExists',
      FST_ERR_RATE_LIMIT: 'auth.tooManyAttempts',
    } as const;
    const key = messages[cause.code as keyof typeof messages];
    return key ? t(key) : cause.code === 'NETWORK_ERROR' ? t('auth.genericError') : cause.message;
  };

  const submit = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password || (mode === 'register' && (!displayName.trim() || !username.trim()))) {
      setError(t('auth.invalidFields'));
      return;
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(cleanEmail, password);
      } else {
        await register({
          email: cleanEmail,
          password,
          username: username.trim(),
          displayName: displayName.trim(),
          locale,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC',
        });
      }
      setPassword('');
      setConfirmPassword('');
      onClose();
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.xl }]}>
          <View style={styles.header}>
            <View>
              <AppText variant="heading" weight="800">{mode === 'login' ? t('auth.welcomeBack') : t('auth.createTitle')}</AppText>
              <AppText variant="small" color={colors.textSecondary}>{mode === 'login' ? t('auth.loginHint') : t('auth.registerHint')}</AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            ref={formScrollRef}
            style={styles.form}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            keyboardDismissMode="none"
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: spacing.xl }}
          >
            {mode === 'register' ? (
              <>
                <Field label={t('auth.displayName')} value={displayName} onChangeText={setDisplayName} placeholder={t('auth.displayNamePlaceholder')} onContainerLayout={rememberFieldPosition('displayName')} onFocus={revealField('displayName')} />
                <Field label={t('auth.username')} value={username} onChangeText={setUsername} placeholder={t('auth.usernamePlaceholder')} autoCapitalize="none" onContainerLayout={rememberFieldPosition('username')} onFocus={revealField('username')} />
              </>
            ) : null}
            <Field label={t('auth.email')} value={email} onChangeText={setEmail} placeholder={t('auth.emailPlaceholder')} keyboardType="email-address" autoCapitalize="none" onContainerLayout={rememberFieldPosition('email')} onFocus={revealField('email')} />
            <Field label={t('auth.password')} value={password} onChangeText={setPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry autoCapitalize="none" onContainerLayout={rememberFieldPosition('password')} onFocus={revealField('password')} />
            {mode === 'register' ? <Field label={t('auth.confirmPassword')} value={confirmPassword} onChangeText={setConfirmPassword} placeholder={t('auth.passwordPlaceholder')} secureTextEntry autoCapitalize="none" onContainerLayout={rememberFieldPosition('confirmPassword')} onFocus={revealField('confirmPassword')} /> : null}
            {error ? <AppText variant="small" color={colors.danger} style={styles.error}>{error}</AppText> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === 'login' ? t('auth.login') : t('auth.register')}
              disabled={submitting}
              onPress={submit}
              style={({ pressed }) => [styles.submit, { backgroundColor: colors.primary, borderRadius: radius.full, opacity: pressed || submitting ? 0.76 : 1 }]}
            >
              <AppText weight="800" color={colors.white}>{submitting ? '…' : mode === 'login' ? t('auth.login') : t('auth.register')}</AppText>
            </Pressable>
            <View style={styles.switchRow}>
              <AppText variant="small" color={colors.textSecondary}>{mode === 'login' ? t('auth.noAccount') : t('auth.hasAccount')}</AppText>
              <Pressable accessibilityRole="button" onPress={() => switchMode(mode === 'login' ? 'register' : 'login')}>
                <AppText variant="small" weight="800" color={colors.primary}>{mode === 'login' ? t('auth.register') : t('auth.login')}</AppText>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string; onContainerLayout?: (event: LayoutChangeEvent) => void }) {
  const { colors, radius } = useAppTheme();
  const { label, onContainerLayout, ...inputProps } = props;
  return (
    <View style={styles.field} onLayout={onContainerLayout}>
      <AppText variant="small" weight="700" style={styles.fieldLabel}>{label}</AppText>
      <TextInput {...inputProps} placeholderTextColor={colors.textSecondary} style={[styles.input, { borderColor: colors.border, color: colors.text, borderRadius: radius.md }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.32)' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { borderTopWidth: 1, maxHeight: '92%', flexShrink: 1, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 },
  form: { flexShrink: 1 },
  field: { marginBottom: 14 },
  fieldLabel: { marginBottom: 7 },
  input: { borderWidth: 1, minHeight: 50, paddingHorizontal: 14, fontSize: 16 },
  error: { marginTop: 2, marginBottom: 8 },
  submit: { minHeight: 52, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginTop: 18, paddingBottom: 8 },
});
