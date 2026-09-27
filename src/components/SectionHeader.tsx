import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Props = {
  title: string;
  action?: string;
};

export function SectionHeader({ title, action }: Props) {
  const { colors, spacing } = useAppTheme();
  return (
    <View style={[styles.row, { marginBottom: spacing.md }]}> 
      <AppText variant="heading" weight="700" style={styles.flex}>{title}</AppText>
      {action ? <AppText variant="small" weight="600" color={colors.primary}>{action}</AppText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flex: { flex: 1 },
});
