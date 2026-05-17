import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors } from '../constants/themes';

interface Props {
  isOffline: boolean;
}

export default function OfflineBanner({ isOffline }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isOffline) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>No internet connection</Text>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    banner: {
      backgroundColor: colors.danger,
      paddingVertical: 8,
      alignItems: 'center',
    },
    text: {
      color: '#fff',
      fontSize: 13,
      fontWeight: '600',
    },
  });
