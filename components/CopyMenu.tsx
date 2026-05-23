import React, { useCallback } from 'react';
import { Pressable, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { testIDs } from '../constants/testIDs';
import BottomSheet from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  originalText: string;
  translatedText: string;
}

/**
 * The shared copy-options sheet — original / translation / both. Mounted once
 * by the screen that owns the target text (TranslationCard for single-shot,
 * ConversationView for the per-turn sheet) so we get one modal across all
 * cards rather than one per card.
 */
export default function CopyMenu({
  visible,
  onClose,
  originalText,
  translatedText,
}: Props) {
  const copy = useCallback(
    async (text: string) => {
      await Clipboard.setStringAsync(text);
      onClose();
    },
    [onClose],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Dismiss copy options"
      testID={testIDs.copy.sheet}
      backdropTestID={testIDs.copy.backdrop}
    >
      <Text className="mb-4 text-center font-mono text-xs uppercase tracking-[2px] text-neon">
        Copy
      </Text>

      <Pressable
        testID={testIDs.copy.original}
        accessibilityRole="button"
        accessibilityLabel="Copy original text"
        onPress={() => copy(originalText)}
        disabled={!originalText}
        className={`mb-2 rounded-xl border px-4 py-3 ${
          originalText ? 'border-neon/30 bg-surface' : 'border-neon/10 bg-surface'
        }`}
      >
        <Text
          className={`font-mono text-sm uppercase tracking-[2px] ${
            originalText ? 'text-fg' : 'text-fg-faint'
          }`}
        >
          Copy original
        </Text>
      </Pressable>

      <Pressable
        testID={testIDs.copy.translation}
        accessibilityRole="button"
        accessibilityLabel="Copy translation"
        onPress={() => copy(translatedText)}
        disabled={!translatedText}
        className={`mb-2 rounded-xl border px-4 py-3 ${
          translatedText ? 'border-neon/30 bg-surface' : 'border-neon/10 bg-surface'
        }`}
      >
        <Text
          className={`font-mono text-sm uppercase tracking-[2px] ${
            translatedText ? 'text-neon' : 'text-fg-faint'
          }`}
        >
          Copy translation
        </Text>
      </Pressable>

      <Pressable
        testID={testIDs.copy.both}
        accessibilityRole="button"
        accessibilityLabel="Copy original and translation"
        onPress={() => copy(`${originalText}\n\n${translatedText}`)}
        disabled={!originalText || !translatedText}
        className={`rounded-xl border px-4 py-3 ${
          originalText && translatedText
            ? 'border-neon bg-neon/10'
            : 'border-neon/10 bg-surface'
        }`}
      >
        <Text
          className={`font-mono text-sm uppercase tracking-[2px] ${
            originalText && translatedText ? 'text-neon' : 'text-fg-faint'
          }`}
        >
          Copy both
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
