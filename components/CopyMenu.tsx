import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Pressable, Text } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { testIDs } from '../constants/testIDs';
import BottomSheet from './BottomSheet';

type CopyKind = 'original' | 'translation' | 'both';

/** How long the "✓ Copied" confirmation stays before the sheet auto-closes. */
const CONFIRM_MS = 900;

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
 *
 * On tap the chosen option confirms inline — it flips to "✓ Copied" and the
 * sheet auto-dismisses a beat later — rather than firing a toast. Inline
 * feedback at the point of action is the current best practice for copy
 * buttons (a toast lands away from the user's focus and is easy to miss); the
 * change is also announced for screen readers, since a silent visual swap is
 * invisible to assistive tech.
 */
export default function CopyMenu({
  visible,
  onClose,
  originalText,
  translatedText,
}: Props) {
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset the confirmation whenever the sheet is dismissed, so the next open
  // starts clean rather than flashing the previous "✓ Copied".
  useEffect(() => {
    if (!visible) setCopied(null);
  }, [visible]);

  // A pending auto-close must not fire after unmount.
  useEffect(
    () => () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    },
    [],
  );

  const copy = useCallback(
    async (kind: CopyKind, text: string) => {
      await Clipboard.setStringAsync(text);
      setCopied(kind);
      AccessibilityInfo.announceForAccessibility('Copied to clipboard');
      if (closeTimer.current) clearTimeout(closeTimer.current);
      closeTimer.current = setTimeout(onClose, CONFIRM_MS);
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
        onPress={() => copy('original', originalText)}
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
          {copied === 'original' ? '✓ Copied' : 'Copy original'}
        </Text>
      </Pressable>

      <Pressable
        testID={testIDs.copy.translation}
        accessibilityRole="button"
        accessibilityLabel="Copy translation"
        onPress={() => copy('translation', translatedText)}
        disabled={!translatedText}
        className={`mb-2 rounded-xl border px-4 py-3 ${
          translatedText ? 'border-neon bg-neon/10' : 'border-neon/10 bg-surface'
        }`}
      >
        <Text
          className={`font-mono text-sm uppercase tracking-[2px] ${
            translatedText ? 'text-neon' : 'text-fg-faint'
          }`}
        >
          {copied === 'translation' ? '✓ Copied' : 'Copy translation'}
        </Text>
      </Pressable>

      <Pressable
        testID={testIDs.copy.both}
        accessibilityRole="button"
        accessibilityLabel="Copy original and translation"
        onPress={() => copy('both', `${originalText}\n\n${translatedText}`)}
        disabled={!originalText || !translatedText}
        className={`rounded-xl border px-4 py-3 ${
          originalText && translatedText
            ? 'border-neon/30 bg-surface'
            : 'border-neon/10 bg-surface'
        }`}
      >
        <Text
          className={`font-mono text-sm uppercase tracking-[2px] ${
            originalText && translatedText ? 'text-neon' : 'text-fg-faint'
          }`}
        >
          {copied === 'both' ? '✓ Copied' : 'Copy both'}
        </Text>
      </Pressable>
    </BottomSheet>
  );
}
