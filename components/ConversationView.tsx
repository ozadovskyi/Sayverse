import React, { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type {
  ConversationSession,
  ConversationTurn,
} from '../constants/conversation';
import { findByCode } from '../constants/languages';
import { testIDs } from '../constants/testIDs';
import CopyMenu from './CopyMenu';

interface Props {
  session: ConversationSession;
}

function languageName(code: string): string {
  return findByCode(code)?.name ?? code.toUpperCase();
}

/**
 * One turn — the spoken text and its translation. Aligned by speaker so the
 * thread reads as a two-person dialogue. The copy trigger lives in the gutter
 * on the opposite side of the bubble, so the empty space created by the
 * `max-w-[85%]` alignment carries a visible affordance instead of nothing.
 */
function TurnBubble({
  turn,
  alignRight,
  onRequestCopy,
}: {
  turn: ConversationTurn;
  alignRight: boolean;
  onRequestCopy: (turn: ConversationTurn) => void;
}) {
  // Auto-detect routes within the chosen pair, so when a third language is
  // spoken the routed `sourceLang` is a fallback that does not match what
  // Whisper heard. Surface both rather than silently mislabel the turn.
  const detectedName = turn.detectedLang ? languageName(turn.detectedLang) : '';
  const showDetected = !!detectedName && turn.detectedLang !== turn.sourceLang;

  const copyButton = (
    <Pressable
      testID={testIDs.copy.trigger(turn.id)}
      accessibilityRole="button"
      accessibilityLabel="Copy turn"
      onPress={() => onRequestCopy(turn)}
      hitSlop={8}
      className="self-end rounded-lg border border-neon/25 bg-surface px-2.5 py-1.5"
    >
      <Text className="font-mono text-[14px] leading-[14px] text-neon/80">⎘</Text>
    </Pressable>
  );

  const bubble = (
    <View
      testID={testIDs.conversation.turn(turn.id)}
      className={`max-w-[85%] rounded-2xl border p-3 ${
        alignRight
          ? 'border-neon/40 bg-surface-panel'
          : 'border-neon/15 bg-surface'
      }`}
    >
      <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-fg-faint">
        {languageName(turn.sourceLang)}
        {showDetected ? (
          <Text className="text-neon/70">{`  ·  heard ${detectedName}`}</Text>
        ) : null}
      </Text>
      <Text className="mt-1 text-[15px] leading-5 text-fg">{turn.originalText}</Text>

      <View className="my-2 h-px bg-neon/15" />

      <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-neon/70">
        {languageName(turn.targetLang)}
      </Text>
      <Text className="mt-1 text-[15px] leading-5 text-neon">
        {turn.translatedText}
      </Text>
    </View>
  );

  return (
    <View className="mb-3 flex-row items-end gap-2">
      {alignRight ? (
        <>
          {copyButton}
          <View className="flex-1 items-end">{bubble}</View>
        </>
      ) : (
        <>
          <View className="flex-1 items-start">{bubble}</View>
          {copyButton}
        </>
      )}
    </View>
  );
}

export default function ConversationView({ session }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [copyTarget, setCopyTarget] = useState<ConversationTurn | null>(null);
  // Auto-scroll state. `scrollToEnd` was the previous behaviour but on long
  // translations dumped the user at the bottom of the new turn — they had to
  // scroll up to read the start. We now jump to the **top** of the freshly
  // appended turn, which is the position of the previous content's bottom
  // edge. The previous content height lives in a ref so the
  // `onContentSizeChange` callback can read it without depending on stale
  // closure state.
  const prevSessionIdRef = useRef(session.id);
  const prevTurnCountRef = useRef(session.turns.length);
  const prevContentHeightRef = useRef(0);

  const handleRequestCopy = useCallback((turn: ConversationTurn) => {
    setCopyTarget(turn);
  }, []);

  const handleCloseCopy = useCallback(() => {
    setCopyTarget(null);
  }, []);

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const sessionChanged = prevSessionIdRef.current !== session.id;
      const turnAppended =
        !sessionChanged && session.turns.length > prevTurnCountRef.current;

      if (sessionChanged) {
        // Loading a different session (or first mount with seeded turns) —
        // skip animation and reveal the most recent turn, matching chat-app
        // behaviour where reopening a thread shows the latest reply first.
        scrollRef.current?.scrollToEnd({ animated: false });
      } else if (turnAppended) {
        // Scroll so the new turn's top edge sits at the top of the viewport.
        // The new turn was appended below the previously-measured content, so
        // the previous total height equals the new turn's y offset.
        scrollRef.current?.scrollTo({
          y: prevContentHeightRef.current,
          animated: prevContentHeightRef.current > 0,
        });
      }

      prevSessionIdRef.current = session.id;
      prevTurnCountRef.current = session.turns.length;
      prevContentHeightRef.current = h;
    },
    [session.id, session.turns.length],
  );

  if (session.turns.length === 0) {
    return (
      <View
        testID={testIDs.conversation.view}
        className="flex-1 items-center justify-center px-6"
      >
        <Text className="text-center font-mono text-xs uppercase leading-5 tracking-[2px] text-fg-faint">
          Tap record and start speaking{'\n'}each turn is translated aloud
        </Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        testID={testIDs.conversation.view}
        ref={scrollRef}
        className="flex-1 px-5"
        onContentSizeChange={handleContentSizeChange}
      >
        <View testID={testIDs.conversation.thread} className="py-3">
          {session.turns.map(turn => (
            <TurnBubble
              key={turn.id}
              turn={turn}
              alignRight={turn.sourceLang === session.langB}
              onRequestCopy={handleRequestCopy}
            />
          ))}
        </View>
      </ScrollView>

      <CopyMenu
        visible={copyTarget !== null}
        onClose={handleCloseCopy}
        originalText={copyTarget?.originalText ?? ''}
        translatedText={copyTarget?.translatedText ?? ''}
      />
    </>
  );
}
