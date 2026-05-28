import React from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { colors } from '../constants/theme';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  /**
   * When true the confirm button reads as destructive — danger-coloured
   * border + text. Used for delete-history / withdraw-consent flows.
   */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  cancelLabel?: string;
  /** testID for the dialog body — gives tests a stable hook. */
  testID?: string;
}

/**
 * Tron-styled confirmation dialog. Used in place of the native
 * `Alert.alert` for destructive actions so the visual language matches
 * the rest of the app instead of breaking into a system sheet.
 *
 * Behaviour mirrors the iOS native confirm Alert it replaces:
 *  - tapping the backdrop cancels (same as system Alert with
 *    `cancelable: true`),
 *  - the confirm button is the primary affordance on the right,
 *  - cancel sits on the left, neutral tone.
 */
export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
  cancelLabel = 'Cancel',
  testID,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        accessibilityLabel="Dismiss"
        onPress={onCancel}
        className="flex-1 items-center justify-center bg-black/70 px-8"
      >
        {/* Swallow taps on the dialog body so they do not dismiss it. */}
        <Pressable
          testID={testID}
          onPress={() => {}}
          style={{
            shadowColor: colors.neon,
            shadowOpacity: 0.35,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 0 },
          }}
          className="w-full max-w-md rounded-2xl border border-neon/30 bg-surface p-6"
        >
          <Text className="mb-2 font-mono text-[11px] uppercase tracking-[3px] text-neon">
            Confirm
          </Text>
          <Text className="mb-3 text-[18px] font-semibold text-fg">
            {title}
          </Text>
          <Text className="mb-6 text-[14px] leading-5 text-fg-muted">
            {message}
          </Text>

          <View className="flex-row justify-end gap-3">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cancelLabel}
              onPress={onCancel}
              className="rounded-xl border border-neon/20 px-5 py-3"
            >
              <Text className="font-mono text-xs uppercase tracking-[2px] text-fg-muted">
                {cancelLabel}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
              onPress={onConfirm}
              className={`rounded-xl border px-5 py-3 ${
                destructive
                  ? 'border-danger/60 bg-danger/10'
                  : 'border-neon bg-neon/10'
              }`}
            >
              <Text
                className={`font-mono text-xs uppercase tracking-[2px] ${
                  destructive ? 'text-danger' : 'text-neon'
                }`}
              >
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
