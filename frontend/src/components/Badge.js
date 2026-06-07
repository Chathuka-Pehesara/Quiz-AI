import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

export default function Badge({ text, type = 'info', style = {}, textStyle = {} }) {
  const { colors } = useTheme();

  const getBadgeColors = () => {
    switch (type) {
      case 'success':
        return { bg: colors.green + '20', text: colors.green }; // 20 adds opacity
      case 'error':
        return { bg: colors.red + '20', text: colors.red };
      case 'warning':
        return { bg: colors.amber + '20', text: colors.amber };
      case 'info':
      default:
        return { bg: colors.primary + '20', text: colors.primary };
    }
  };

  const badgeColors = getBadgeColors();

  return (
    <View style={[
      styles.badge, 
      { backgroundColor: badgeColors.bg }, 
      style
    ]}>
      <Text style={[
        styles.text, 
        { color: badgeColors.text }, 
        textStyle
      ]}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BORDER_RADIUS.round,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    alignSelf: 'flex-start',
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: TYPOGRAPHY.sizes.xs,
    fontWeight: TYPOGRAPHY.weights.bold,
    textTransform: 'uppercase',
  },
});
