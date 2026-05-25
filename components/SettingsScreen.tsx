import React from 'react';
import { Pressable, Text, View } from 'react-native';

import { testIDs } from '../constants/testIDs';
import BottomSheet from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  onLogout: () => void;
  /** Whether translations are read aloud in conversation mode. */
  speakAloud: boolean;
  onToggleSpeakAloud: () => void;
  /** Whether the source-language half of each conversation turn is hidden. */
  hideOriginal: boolean;
  onToggleHideOriginal: () => void;
}

export default function SettingsScreen({
  visible,
  onClose,
  onLogout,
  speakAloud,
  onToggleSpeakAloud,
  hideOriginal,
  onToggleHideOriginal,
}: Props) {
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close settings"
      testID={testIDs.settings.screen}
    >
      <Text className="mb-6 text-center font-mono text-base uppercase tracking-[3px] text-neon">
        Settings
      </Text>

      <View className="mb-6 rounded-xl border border-neon/15 bg-surface-input p-4">
        <Text className="text-lg font-semibold text-fg">Sayverse</Text>
        <Text className="mt-1 text-sm text-fg-muted">
          Voice & text translator built with OpenAI Whisper and GPT-4o-mini.
        </Text>
        <Text className="mt-2 font-mono text-xs text-fg-faint">v1.0.0</Text>
      </View>

      <Text className="mb-2 font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
        Voice
      </Text>
      <Pressable
        testID={testIDs.settings.speakAloudToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: speakAloud }}
        accessibilityLabel="Speak translations aloud"
        onPress={onToggleSpeakAloud}
        className="mb-6 flex-row items-center justify-between rounded-xl border border-neon/15 bg-surface-input p-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-base text-fg">Speak translations aloud</Text>
          <Text className="mt-1 text-[13px] text-fg-muted">
            Read each translation out loud in conversation mode.
          </Text>
        </View>
        <View
          className={`rounded-full border px-3 py-1 ${
            speakAloud ? 'border-neon bg-neon/10' : 'border-neon/20'
          }`}
        >
          <Text
            className={`font-mono text-[11px] uppercase tracking-[2px] ${
              speakAloud ? 'text-neon' : 'text-fg-faint'
            }`}
          >
            {speakAloud ? 'On' : 'Off'}
          </Text>
        </View>
      </Pressable>

      <Text className="mb-2 font-mono text-[11px] uppercase tracking-[2px] text-fg-muted">
        Conversation
      </Text>
      <Pressable
        testID={testIDs.settings.hideOriginalToggle}
        accessibilityRole="switch"
        accessibilityState={{ checked: hideOriginal }}
        accessibilityLabel="Hide original text in conversation"
        onPress={onToggleHideOriginal}
        className="mb-6 flex-row items-center justify-between rounded-xl border border-neon/15 bg-surface-input p-4"
      >
        <View className="flex-1 pr-3">
          <Text className="text-base text-fg">Hide original text</Text>
          <Text className="mt-1 text-[13px] text-fg-muted">
            Show only the translated half of each turn — useful for live
            face-to-face dialogue where the source is not needed on screen.
          </Text>
        </View>
        <View
          className={`rounded-full border px-3 py-1 ${
            hideOriginal ? 'border-neon bg-neon/10' : 'border-neon/20'
          }`}
        >
          <Text
            className={`font-mono text-[11px] uppercase tracking-[2px] ${
              hideOriginal ? 'text-neon' : 'text-fg-faint'
            }`}
          >
            {hideOriginal ? 'On' : 'Off'}
          </Text>
        </View>
      </Pressable>

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
    </BottomSheet>
  );
}
