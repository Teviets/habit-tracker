import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Props = {
  label: string;
  selected?: boolean;
  onPress: () => void;
};

export function ChoiceChip({ label, selected = false, onPress }: Props) {
  const { colors, radius, spacing } = useAppTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          borderRadius: radius.full,
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          paddingHorizontal: spacing.lg,
          opacity: pressed ? 0.75 : 1,
        },
      ]}
    >
      <AppText variant="small" weight="600" color={selected ? colors.primary : colors.textSecondary}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 42, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
