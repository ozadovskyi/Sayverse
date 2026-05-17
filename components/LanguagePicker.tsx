import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, FlatList } from 'react-native';
import { Language, LANGUAGES } from '../constants/languages';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeColors } from '../constants/themes';

interface Props {
  source: Language;
  target: Language;
  onChangeSource: (lang: Language) => void;
  onChangeTarget: (lang: Language) => void;
  onSwap: () => void;
}

export default function LanguagePicker({ source, target, onChangeSource, onChangeTarget, onSwap }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [modal, setModal] = React.useState<'source' | 'target' | null>(null);

  const handleSelect = (lang: Language) => {
    if (modal === 'source') onChangeSource(lang);
    else if (modal === 'target') onChangeTarget(lang);
    setModal(null);
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.langButton} onPress={() => setModal('source')}>
        <Text style={styles.langText}>{source.name}</Text>
        <Text style={styles.langNative}>{source.nativeName}</Text>
      </Pressable>

      <Pressable style={styles.swapButton} onPress={onSwap}>
        <Text style={styles.swapIcon}>{'<->'}</Text>
      </Pressable>

      <Pressable style={styles.langButton} onPress={() => setModal('target')}>
        <Text style={styles.langText}>{target.name}</Text>
        <Text style={styles.langNative}>{target.nativeName}</Text>
      </Pressable>

      <Modal visible={modal !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modal === 'source' ? 'Source language' : 'Target language'}
            </Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <Pressable style={styles.modalItem} onPress={() => handleSelect(item)}>
                  <Text style={styles.modalItemText}>{item.name}</Text>
                  <Text style={styles.modalItemNative}>{item.nativeName}</Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.cancelButton} onPress={() => setModal(null)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    langButton: {
      flex: 1,
      backgroundColor: colors.bgCard,
      borderRadius: 12,
      padding: 12,
      alignItems: 'center',
      borderWidth: colors.neonGlow ? 1 : 0,
      borderColor: colors.border,
    },
    langText: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: '600',
    },
    langNative: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
    swapButton: {
      backgroundColor: colors.bgInput,
      borderRadius: 20,
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swapIcon: {
      color: colors.accent,
      fontSize: 16,
      fontWeight: '700',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.modalOverlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.bgCard,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingTop: 20,
      paddingHorizontal: 16,
      maxHeight: '70%',
    },
    modalTitle: {
      color: colors.textPrimary,
      fontSize: 18,
      fontWeight: '700',
      textAlign: 'center',
      marginBottom: 16,
    },
    modalItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalItemText: {
      color: colors.textPrimary,
      fontSize: 16,
    },
    modalItemNative: {
      color: colors.textSecondary,
      fontSize: 14,
    },
    cancelButton: {
      paddingVertical: 16,
      alignItems: 'center',
    },
    cancelText: {
      color: colors.danger,
      fontSize: 16,
      fontWeight: '600',
    },
  });
