import React, { ComponentProps } from 'react';
import { Text, TextStyle } from 'react-native';

import { useAppTheme } from '../theme/ThemeProvider';

type TextVariant = 'hero' | 'title' | 'heading' | 'body' | 'small' | 'caption';

type Props = ComponentProps<typeof Text> & {
  variant?: TextVariant;
  color?: string;
  weight?: TextStyle['fontWeight'];
};

export function AppText({ variant = 'body', color, weight, style, ...props }: Props) {
  const { colors, typography } = useAppTheme();
  return (
    <Text
      {...props}
      style={[
        {
          color: color ?? colors.text,
          fontSize: typography[variant],
          lineHeight: Math.round(typography[variant] * 1.35),
          fontWeight: weight,
        },
        style,
      ]}
    />
  );
}
