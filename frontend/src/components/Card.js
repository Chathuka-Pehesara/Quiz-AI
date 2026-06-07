import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING } from '../constants/theme';

export default function Card({ children, style = {} }) {
  const { colors } = useTheme();

  return (
    <View style={[
      styles.card, 
      { 
        backgroundColor: colors.card,
        borderColor: colors.border,
      }, 
      style
    ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
});
