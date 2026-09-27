import Ionicons from '@expo/vector-icons/Ionicons';
import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { useAuth } from '../auth/AuthProvider';
import { AuthenticationGate } from '../components/AuthenticationGate';
import { AppText } from '../components/AppText';
import { ChoiceChip } from '../components/ChoiceChip';
import { Screen } from '../components/Screen';
import { HabitGroup, habitApi } from '../features/habits/api';
import { useI18n } from '../i18n/I18nProvider';
import { useAppTheme } from '../theme/ThemeProvider';
import { RootTabParamList } from '../types/navigation';

const CATEGORIES = [
  { key: 'movement', icon: 'walk-outline' }, { key: 'strength', icon: 'barbell-outline' }, { key: 'running', icon: 'fitness-outline' },
  { key: 'mind', icon: 'leaf-outline' }, { key: 'meditation', icon: 'flower-outline' }, { key: 'learning', icon: 'school-outline' },
  { key: 'nutrition', icon: 'nutrition-outline' }, { key: 'hydration', icon: 'water-outline' }, { key: 'cooking', icon: 'restaurant-outline' },
  { key: 'rest', icon: 'moon-outline' }, { key: 'sleep', icon: 'bed-outline' }, { key: 'selfcare', icon: 'heart-outline' },
  { key: 'productivity', icon: 'checkmark-done-outline' }, { key: 'focus', icon: 'timer-outline' }, { key: 'finance', icon: 'wallet-outline' },
  { key: 'social', icon: 'people-outline' }, { key: 'nature', icon: 'sunny-outline' }, { key: 'creativity', icon: 'color-palette-outline' },
] as const;
const UNITS = ['veces', 'cantidad', 'completado', 'cronometro', 'minutos', 'horas', 'pasos', 'vasos', 'paginas', 'kilometros', 'calorias'] as const;
const DAYS = [{ value: 1, label: 'L' }, { value: 2, label: 'M' }, { value: 3, label: 'X' }, { value: 4, label: 'J' }, { value: 5, label: 'V' }, { value: 6, label: 'S' }, { value: 7, label: 'D' }];
const COLORS = ['#2E8067', '#FF8D73', '#8D83CF', '#3597C8', '#E7B44E'];
type Frequency = 'daily' | 'weekdays' | 'custom';

export function AddHabitScreen() {
  const { colors, radius, spacing } = useAppTheme();
  const { t } = useI18n();
  const { accessToken, isAuthenticated, user } = useAuth();
  const navigation = useNavigation();
  const editing = useRoute<RouteProp<RootTabParamList, 'Add'>>().params?.habit;
  const [name, setName] = useState('');
  const [category, setCategory] = useState<typeof CATEGORIES[number]['key']>('movement');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [unit, setUnit] = useState<typeof UNITS[number]>('veces');
  const [target, setTarget] = useState('1');
  const [color, setColor] = useState(COLORS[0]);
  const [privacy, setPrivacy] = useState<'private' | 'public'>('private');
  const [groups, setGroups] = useState<HabitGroup[]>([]);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryModal, setCategoryModal] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!editing) return;
    setName(editing.name); setColor(editing.color); setTarget(String(editing.targetCount)); setDays(editing.daysOfWeek); setGroupId(editing.habitGroupId); setPrivacy(editing.privacy === 'public' ? 'public' : 'private');
    setUnit(UNITS.includes(editing.unit as typeof UNITS[number]) ? editing.unit as typeof UNITS[number] : 'veces');
    setFrequency(editing.frequency === 'daily' ? 'daily' : editing.daysOfWeek.join(',') === '1,2,3,4,5' ? 'weekdays' : 'custom');
    const found = CATEGORIES.find((item) => item.icon === editing.icon); if (found) setCategory(found.key);
  }, [editing]);
  useEffect(() => { if (accessToken && user?.isPremium) habitApi.listGroups(accessToken).then(setGroups).catch(() => setGroups([])); }, [accessToken, user?.isPremium]);
  if (!isAuthenticated || !accessToken) return <Screen><AuthenticationGate messageKey="auth.requiredProfile" icon="checkbox-outline" /></Screen>;

  const selectedCategory = CATEGORIES.find((item) => item.key === category) ?? CATEGORIES[0];
  const matches = CATEGORIES.filter((item) => t(`category.${item.key}`).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const selectedDays = frequency === 'daily' ? [1, 2, 3, 4, 5, 6, 7] : frequency === 'weekdays' ? [1, 2, 3, 4, 5] : days;
  const save = async (selectedPrivacy?: 'private' | 'public') => {
    if (!editing && !selectedPrivacy) {
      Alert.alert(t('add.visibilityTitle'), t('add.visibilityHint'), [
        { text: t('add.private'), onPress: () => void save('private') },
        { text: t('add.public'), onPress: () => void save('public') },
      ]);
      return;
    }
    if (!name.trim() || !selectedDays.length) return;
    setSaving(true);
    try {
      const input = { name: name.trim(), icon: selectedCategory.icon, color, frequency: frequency === 'daily' ? 'daily' as const : 'custom' as const, daysOfWeek: selectedDays, targetCount: Math.max(1, Number.parseInt(target, 10) || 1), unit, habitGroupId: groupId, privacy: selectedPrivacy ?? privacy };
      if (editing) await habitApi.update(accessToken, editing.id, input); else await habitApi.create(accessToken, input);
      navigation.navigate('Habits' as never);
    } catch { Alert.alert(t('add.errorTitle'), t('add.errorMessage')); } finally { setSaving(false); }
  };
  const remove = () => { if (editing) Alert.alert(t('add.deleteTitle'), t('add.deleteMessage'), [{ text: t('home.cancel'), style: 'cancel' }, { text: t('add.delete'), style: 'destructive', onPress: () => void habitApi.remove(accessToken, editing.id).then(() => navigation.navigate('Habits' as never)) }]); };
  const confirmSave = () => {
    if (editing) { void save(); return; }
    Alert.alert(t('add.visibilityTitle'), t('add.visibilityHint'), [
      { text: t('add.private'), onPress: () => void save('private') },
      { text: t('add.public'), onPress: () => void save('public') },
    ]);
  };

  return <Screen><View style={{ marginTop: spacing.md }}><AppText variant="caption" weight="800" color={colors.primary} style={styles.eyebrow}>{t('add.eyebrow')}</AppText><AppText variant="hero" weight="800">{editing ? t('add.editTitle') : t('add.title')}</AppText><AppText color={colors.textSecondary}>{t('add.subtitle')}</AppText></View><View style={[styles.form, { backgroundColor: colors.surface, borderRadius: radius.xl, padding: spacing.xl, marginTop: spacing.xxl }]}><Label value={t('add.name')} /><Input value={name} onChangeText={setName} placeholder={t('add.namePlaceholder')} colors={colors} radius={radius.md} /><Label value={t('add.category')} /><Pressable onPress={() => setCategoryModal(true)} style={[styles.categorySelector, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: radius.md }]}><Ionicons name={selectedCategory.icon} size={22} color={colors.primary} /><AppText weight="700" style={styles.grow}>{t(`category.${selectedCategory.key}`)}</AppText><Ionicons name="chevron-down" size={20} color={colors.textSecondary} /></Pressable><Label value={t('add.frequency')} /><View style={styles.wrap}>{(['daily', 'weekdays', 'custom'] as const).map((item) => <ChoiceChip key={item} label={t(`frequency.${item}`)} selected={frequency === item} onPress={() => setFrequency(item)} />)}</View>{frequency === 'custom' ? <><Label value={t('add.customDays')} /><View style={styles.wrap}>{DAYS.map((day) => <ChoiceChip key={day.value} label={day.label} selected={days.includes(day.value)} onPress={() => setDays((current) => current.includes(day.value) ? current.filter((value) => value !== day.value) : [...current, day.value].sort())} />)}</View></> : null}<Label value={t('add.target')} /><Input value={target} onChangeText={setTarget} keyboardType="number-pad" colors={colors} radius={radius.md} /><Label value={t('add.unit')} /><View style={styles.wrap}>{UNITS.map((item) => <ChoiceChip key={item} label={t(`unit.${item}`)} selected={unit === item} onPress={() => setUnit(item)} />)}</View><Label value={t('add.color')} /><View style={styles.wrap}>{COLORS.map((item) => <Pressable key={item} onPress={() => setColor(item)} style={[styles.dotOuter, { borderColor: color === item ? item : 'transparent' }]}><View style={[styles.dot, { backgroundColor: item }]} /></Pressable>)}</View>{user?.isPremium ? <><Label value={t('add.habitGroup')} /><View style={styles.wrap}><ChoiceChip label={t('add.noGroup')} selected={!groupId} onPress={() => setGroupId(null)} />{groups.map((group) => <ChoiceChip key={group.id} label={group.name} selected={groupId === group.id} onPress={() => setGroupId(group.id)} />)}</View></> : <View style={[styles.premium, { backgroundColor: colors.accentSoft, borderRadius: radius.md }]}><Ionicons name="sparkles" color={colors.accent} size={18} /><AppText variant="small">{t('add.groupsPremium')}</AppText></View>}</View><Pressable disabled={!name.trim() || saving || !selectedDays.length} onPress={() => void save()} style={[styles.save, { backgroundColor: name.trim() ? colors.primary : colors.surfaceMuted, borderRadius: radius.lg, marginTop: spacing.xl }]}><AppText weight="800" color={colors.white}>{saving ? '…' : t('common.save')}</AppText></Pressable>{editing ? <Pressable onPress={remove} style={styles.delete}><AppText weight="700" color={colors.danger}>{t('add.delete')}</AppText></Pressable> : null}<Modal transparent animationType="slide" visible={categoryModal} onRequestClose={() => setCategoryModal(false)}><View style={styles.overlay}><View style={[styles.categoryModal, { backgroundColor: colors.surface, borderRadius: radius.xl }]}><View style={styles.modalHeader}><AppText variant="heading" weight="800">{t('add.category')}</AppText><Pressable onPress={() => setCategoryModal(false)}><Ionicons name="close" size={24} color={colors.textSecondary} /></Pressable></View><Input value={query} onChangeText={setQuery} placeholder={t('add.searchCategories')} colors={colors} radius={radius.md} /><ScrollView keyboardShouldPersistTaps="handled">{matches.map((item) => <Pressable key={item.key} onPress={() => { setCategory(item.key); setQuery(''); setCategoryModal(false); }} style={[styles.categoryOption, { borderColor: colors.border }]}><Ionicons name={item.icon} size={22} color={item.key === category ? colors.primary : colors.textSecondary} /><AppText weight={item.key === category ? '800' : '600'} style={styles.grow}>{t(`category.${item.key}`)}</AppText>{item.key === category ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}</Pressable>)}</ScrollView></View></View></Modal></Screen>;
}

function Label({ value }: { value: string }) { return <AppText variant="small" weight="700" style={styles.label}>{value}</AppText>; }
function Input({ colors, radius, ...props }: React.ComponentProps<typeof TextInput> & { colors: ReturnType<typeof useAppTheme>['colors']; radius: number }) { return <TextInput {...props} placeholderTextColor={colors.textSecondary} style={[styles.input, { color: colors.text, borderColor: colors.border, borderRadius: radius }]} />; }
const styles = StyleSheet.create({ eyebrow: { letterSpacing: 1.4, marginBottom: 4 }, form: { gap: 10 }, label: { marginTop: 10 }, input: { borderWidth: 1, minHeight: 52, paddingHorizontal: 14, fontSize: 16 }, categorySelector: { minHeight: 56, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 14 }, grow: { flex: 1 }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, dotOuter: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: 'center', justifyContent: 'center' }, dot: { width: 30, height: 30, borderRadius: 15 }, premium: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 13, marginTop: 10 }, save: { minHeight: 58, alignItems: 'center', justifyContent: 'center' }, delete: { alignItems: 'center', padding: 18 }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' }, categoryModal: { maxHeight: '86%', padding: 20, gap: 14 }, modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, categoryOption: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 13, borderBottomWidth: StyleSheet.hairlineWidth } });
