import React, { useRef } from 'react';
import { ScrollView, Text, View } from 'react-native';

import type {
  ConversationSession,
  ConversationTurn,
} from '../constants/conversation';
import { findByCode } from '../constants/languages';
import { testIDs } from '../constants/testIDs';

interface Props {
  session: ConversationSession;
}

function languageName(code: string): string {
  return findByCode(code)?.name ?? code.toUpperCase();
}

/**
 * One turn — the spoken text and its translation. Aligned by speaker so the
 * thread reads as a two-person dialogue.
 */
function TurnBubble({
  turn,
  alignRight,
}: {
  turn: ConversationTurn;
  alignRight: boolean;
}) {
  // Auto-detect routes within the chosen pair, so when a third language is
  // spoken the routed `sourceLang` is a fallback that does not match what
  // Whisper heard. Surface both rather than silently mislabel the turn.
  const detectedName = turn.detectedLang ? languageName(turn.detectedLang) : '';
  const showDetected = !!detectedName && turn.detectedLang !== turn.sourceLang;
  return (
    <View
      testID={testIDs.conversation.turn(turn.id)}
      className={`mb-3 max-w-[85%] rounded-2xl border p-3 ${
        alignRight
          ? 'self-end border-neon/40 bg-surface-panel'
          : 'self-start border-neon/15 bg-surface'
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
}

export default function ConversationView({ session }: Props) {
  const scrollRef = useRef<ScrollView>(null);

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
    <ScrollView
      testID={testIDs.conversation.view}
      ref={scrollRef}
      className="flex-1 px-5"
      onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
    >
      <View testID={testIDs.conversation.thread} className="py-3">
        {session.turns.map(turn => (
          <TurnBubble
            key={turn.id}
            turn={turn}
            alignRight={turn.sourceLang === session.langB}
          />
        ))}
      </View>
    </ScrollView>
  );
}
