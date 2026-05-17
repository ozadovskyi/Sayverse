import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors, ThemeName, themes } from '../constants/themes';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const THEME_OPTIONS: { name: ThemeName; label: string; description: string }[] = [
  { name: 'monochrome', label: 'Monochrome', description: 'Clean, minimal, black & white' },
  { name: 'neonTron', label: 'Neon Tron', description: 'Dark with cyan & magenta glow' },
];

export default function SettingsScreen({ visible, onClose }: Props) {
  const { colors, themeName, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>Settings</Text>

          <Text style={styles.sectionLabel}>Theme</Text>
          {THEME_OPTIONS.map(option => {
            const isSelected = option.name === themeName;
            const preview = themes[option.name];
            return (
              <Pressable
                key={option.name}
                style={[styles.themeCard, isSelected && styles.themeCardSelected]}
                onPress={() => setTheme(option.name)}
              >
                <View style={styles.themeCardHeader}>
                  <View style={[styles.previewDot, { backgroundColor: preview.accent }]} />
                  <View style={[styles.previewDot, { backgroundColor: preview.bg }]} />
                  <View style={[styles.previewDot, { backgroundColor: preview.bgCard }]} />
                  {preview.neonGlow && (
                    <View style={[styles.previewDot, {
                      backgroundColor: preview.neonGlow,
                      shadowColor: preview.neonGlow,
                      shadowRadius: 6,
                      shadowOpacity: 0.8,
                      shadowOffset: { width: 0, height: 0 },
                    }]} />
                  )}
                </View>
                <Text style={styles.themeLabel}>{option.label}</Text>
                <Text style={styles.themeDescription}>{option.description}</Text>
                {isSelected && <Text style={styles.checkmark}>Active</Text>}
              </Pressable>
            );
          })}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    content: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: '800',
      textAlign: 'center',
      marginBottom: 24,
    },
    sectionLabel: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: '600',
      textTransform: 'uppercase',
      marginBottom: 12,
    },
    themeCard: {
      backgroundColor: colors.bgInput,
      borderRadius: 14,
      padding: 16,
      marginBottom: 12,
      borderWidth: 2,
      borderColor: 'transparent',
    },
    themeCardSelected: {
      borderColor: colors.accent,
      ...(colors.neonGlow ? {
        shadowColor: colors.neonGlow,
        shadowRadius: 10,
        shadowOpacity: 0.4,
        shadowOffset: { width: 0, height: 0 },
      } : {}),
    },
    themeCardHeader: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 10,
    },
    previewDot: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    themeLabel: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: '700',
    },
    themeDescription: {
      color: colors.textSecondary,
      fontSize: 13,
      marginTop: 4,
    },
    checkmark: {
      color: colors.accent,
      fontSize: 12,
      fontWeight: '700',
      marginTop: 8,
      textTransform: 'uppercase',
    },
    closeButton: {
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
    },
    closeText: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: '600',
    },
  });
