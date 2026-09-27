import Ionicons from '@expo/vector-icons/Ionicons';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

type Props = {
  title: string;
  meta: string;
  icon: IconName;
  tint: string;
  completed: boolean;
  onPress: () => void;
};

export function HabitCard({ title, meta, icon, tint, completed, onPress }: Props) {
  const { colors, radius, spacing } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: completed }}
      accessibilityLabel={`${title}, ${meta}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: completed ? tint : colors.border,
          borderRadius: radius.lg,
          padding: spacing.lg,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: `${tint}22`, borderRadius: radius.md }]}> 
        <Ionicons name={icon} size={24} color={tint} />
      </View>
      <View style={styles.copy}>
        <AppText weight="700" style={completed ? styles.completedText : undefined}>{title}</AppText>
        <AppText variant="small" color={colors.textSecondary}>{meta}</AppText>
      </View>
      <View style={[styles.check, { borderColor: completed ? tint : colors.border, backgroundColor: completed ? tint : 'transparent' }]}> 
        {completed ? <Ionicons name="checkmark" size={18} color={colors.white} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 10,
  },
  icon: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, paddingHorizontal: 14 },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  completedText: { textDecorationLine: 'line-through', opacity: 0.7 },
});
