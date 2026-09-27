import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '../components/AppText';
import { AuthenticationGate } from '../components/AuthenticationGate';
import { ChoiceChip } from '../components/ChoiceChip';
import { Screen } from '../components/Screen';
import { useAuth } from '../auth/AuthProvider';
import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { RootStackParamList } from '../types/navigation';

export function ChatScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { t } = useI18n();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { isAuthenticated } = useAuth();
  const [message, setMessage] = useState('');
  const [sentMessages, setSentMessages] = useState<string[]>([]);

  if (!isAuthenticated) {
    return <Screen><AuthenticationGate messageKey="auth.requiredChat" icon="chatbubble-ellipses-outline" /></Screen>;
  }

  const send = () => {
    const cleanMessage = message.trim();
    if (!cleanMessage) return;
    setSentMessages((current) => [...current, cleanMessage]);
    setMessage('');
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Screen>
        <View style={[styles.header, { marginTop: spacing.md, marginBottom: spacing.xxl }]}> 
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('nav.home')}
            onPress={() => navigation.goBack()}
            style={[styles.backButton, { backgroundColor: colors.surfaceMuted }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <View style={[styles.coachAvatar, { backgroundColor: colors.primarySoft }]}> 
            <Ionicons name="leaf" size={24} color={colors.primary} />
            <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.background }]} />
          </View>
          <View style={styles.headerCopy}>
            <AppText variant="heading" weight="800">{t('chat.title')}</AppText>
            <AppText variant="small" color={colors.textSecondary}>{t('chat.subtitle')}</AppText>
          </View>
        </View>

        <View style={styles.conversation}>
          <Bubble text={t('chat.welcome')} side="coach" />
          <Bubble text={t('chat.reply')} side="user" />
          <Bubble text={t('chat.coach')} side="coach" />
          {sentMessages.map((text, index) => <Bubble key={`${text}-${index}`} text={text} side="user" />)}
        </View>

        <View style={[styles.prompts, { marginVertical: spacing.xl }]}> 
          {[t('chat.prompt1'), t('chat.prompt2'), t('chat.prompt3')].map((prompt) => (
            <ChoiceChip key={prompt} label={prompt} onPress={() => setMessage(prompt)} />
          ))}
        </View>

        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.xl, padding: spacing.sm }]}> 
          <TextInput
            accessibilityLabel={t('chat.placeholder')}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textSecondary}
            value={message}
            onChangeText={setMessage}
            onSubmitEditing={send}
            returnKeyType="send"
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
            onPress={send}
            style={({ pressed }) => [styles.send, { backgroundColor: message.trim() ? colors.primary : colors.surfaceMuted, opacity: pressed ? 0.75 : 1 }]}
          >
            <Ionicons name="arrow-up" size={22} color={message.trim() ? colors.white : colors.textSecondary} />
          </Pressable>
        </View>
        <AppText variant="caption" color={colors.textSecondary} style={[styles.disclaimer, { marginTop: spacing.md }]}>{t('chat.disclaimer')}</AppText>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Bubble({ text, side }: { text: string; side: 'coach' | 'user' }) {
  const { colors, radius, spacing } = useAppTheme();
  const isUser = side === 'user';
  return (
    <View style={[
      styles.bubble,
      {
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        backgroundColor: isUser ? colors.primary : colors.surface,
        borderRadius: radius.lg,
        padding: spacing.lg,
      },
    ]}>
      <AppText color={isUser ? colors.white : colors.text}>{text}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  coachAvatar: { width: 52, height: 52, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, right: -1, bottom: -1, borderWidth: 2 },
  headerCopy: { flex: 1, marginLeft: 14 },
  conversation: { gap: 12 },
  bubble: { maxWidth: '84%' },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  composer: { minHeight: 58, flexDirection: 'row', alignItems: 'center', borderWidth: 1 },
  input: { flex: 1, minHeight: 44, fontSize: 16, paddingHorizontal: 12 },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  disclaimer: { textAlign: 'center', paddingHorizontal: 18 },
});
