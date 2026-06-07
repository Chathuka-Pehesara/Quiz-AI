import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { SPACING, TYPOGRAPHY } from '../constants/theme';
import PrimaryButton from './PrimaryButton';

export default function EmptyState({
  illustration = '🔍',
  title = 'No Data Available',
  description = 'There is currently nothing to show here.',
  actionTitle,
  onActionPress,
  style = {},
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.illustration}>{illustration}</Text>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      
      {actionTitle && onActionPress && (
        <PrimaryButton
          title={actionTitle}
          onPress={onActionPress}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: SPACING.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  illustration: {
    fontSize: 64,
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: TYPOGRAPHY.sizes.xl,
    fontWeight: TYPOGRAPHY.weights.bold,
    textAlign: 'center',
    marginBottom: SPACING.xs,
  },
  description: {
    fontSize: TYPOGRAPHY.sizes.md,
    textAlign: 'center',
    marginBottom: SPACING.xl,
    paddingHorizontal: SPACING.xl,
    lineHeight: 20,
  },
  button: {
    minWidth: 150,
  },
});
