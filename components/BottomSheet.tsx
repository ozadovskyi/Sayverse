import React from 'react';
import { Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Accessibility label for the dismiss backdrop. */
  closeLabel: string;
  /** testID for the sheet container, when a test needs to assert on it. */
  testID?: string;
  /** testID for the backdrop, for tap-to-dismiss tests. */
  backdropTestID?: string;
  /** Optional max-height utility class, e.g. `max-h-[70%]` for long lists. */
  maxHeightClass?: string;
  children: React.ReactNode;
}

/**
 * The shared bottom-sheet modal shell — used by the language picker, the
 * settings sheet and the conversation-history browser.
 *
 * Extracted after the same Modal + backdrop + safe-area structure was
 * written three times (and the same dismiss bug fixed three times). It owns:
 * the slide-up `Modal`, a dimmed backdrop that dismisses on tap, a tap-sink
 * so presses on the sheet body do not reach the backdrop, and a bottom inset
 * that keeps the sheet's last control clear of the Android navigation bar.
 */
export default function BottomSheet({
  visible,
  onClose,
  closeLabel,
  testID,
  backdropTestID,
  maxHeightClass,
  children,
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide">
      <Pressable
        testID={backdropTestID}
        accessibilityLabel={closeLabel}
        className="flex-1 justify-end bg-black/70"
        onPress={onClose}
      >
        {/* Swallow taps on the sheet so they do not reach the backdrop. */}
        <Pressable
          testID={testID}
          onPress={() => {}}
          style={{ paddingBottom: insets.bottom + 16 }}
          className={`rounded-t-3xl border-t border-neon/30 bg-surface px-5 pt-5 ${
            maxHeightClass ?? ''
          }`}
        >
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}
