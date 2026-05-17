import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { testIDs } from '../constants/testIDs';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
}

export default function SettingsScreen({ visible, onClose, onLogout }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide">
      {/* Tapping the dimmed backdrop dismisses the sheet. */}
      <Pressable
        accessibilityLabel="Close settings"
        className="flex-1 justify-end bg-black/70"
        onPress={onClose}
      >
        {/* Swallow taps on the sheet so they do not reach the backdrop. */}
        <Pressable
          testID={testIDs.settings.screen}
          onPress={() => {}}
          style={{ paddingBottom: insets.bottom + 16 }}
          className="rounded-t-3xl border-t border-neon/30 bg-surface px-5 pt-5"
        >
          <Text className="mb-6 text-center font-mono text-base uppercase tracking-[3px] text-neon">
            Settings
          </Text>

          <View className="mb-6 rounded-xl border border-neon/15 bg-surface-input p-4">
            <Text className="text-lg font-semibold text-fg">OpenTranslator</Text>
            <Text className="mt-1 text-sm text-fg-muted">
              Voice & text translator powered by OpenAI.
            </Text>
            <Text className="mt-2 font-mono text-xs text-fg-faint">v1.0.0</Text>
          </View>

          <Text className="mb-2 font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
            API key
          </Text>
          <Pressable
            testID={testIDs.settings.logoutButton}
            accessibilityRole="button"
            accessibilityLabel="Reset API key"
            onPress={onLogout}
            className="mb-4 items-center rounded-xl border border-danger/40 bg-danger/10 py-3.5"
          >
            <Text className="font-mono text-sm uppercase tracking-[2px] text-danger">
              Reset API key
            </Text>
          </Pressable>

          <Pressable
            testID={testIDs.settings.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            onPress={onClose}
            className="items-center py-3"
          >
            <Text className="font-mono text-sm uppercase tracking-[2px] text-fg-muted">
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
