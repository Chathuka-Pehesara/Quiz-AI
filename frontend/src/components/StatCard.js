import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { BORDER_RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';

export default function StatCard({ label, value, icon, color, style = {} }) {
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
      <Text 
        numberOfLines={1} 
        adjustsFontSizeToFit 
        minimumFontScale={0.7} 
        style={[styles.label, { color: colors.textMuted }]}
      >
        {label}
      </Text>
      
      {icon && (
        <Text style={styles.icon}>{icon}</Text>
      )}

      <Text style={[
        styles.value, 
        { color: color || colors.text }
      ]}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md, // rounded corners (12px)
    padding: 12, // padding 12px
  },
  label: {
    fontSize: 11, // 11px
    fontWeight: '600',
    flexShrink: 1,
    marginBottom: SPACING.xs,
  },
  icon: {
    fontSize: 16,
    marginTop: SPACING.xs,
  },
  value: {
    fontSize: 22, // 22px
    fontWeight: 'bold',
    marginTop: SPACING.xs,
  },
});
