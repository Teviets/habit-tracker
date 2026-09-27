import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { useAppTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';

type Props = {
  progress: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
};

export function ProgressRing({ progress, size = 108, strokeWidth = 10, label }: Props) {
  const { colors } = useAppTheme();
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const safeProgress = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.container, { width: size, height: size }]}> 
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          stroke={colors.surfaceMuted}
          fill="transparent"
          strokeWidth={strokeWidth}
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <Circle
          stroke={colors.accent}
          fill="transparent"
          strokeLinecap="round"
          strokeWidth={strokeWidth}
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference - safeProgress * circumference}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.center}>
        <AppText variant="heading" weight="800">{Math.round(safeProgress * 100)}%</AppText>
        {label ? <AppText variant="caption" color={colors.textSecondary}>{label}</AppText> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  svg: { position: 'absolute' },
  center: { alignItems: 'center' },
});
