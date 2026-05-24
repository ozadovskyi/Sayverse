import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';

import type {
  ConversationSession,
  ConversationTurn,
} from '../constants/conversation';
import { findByCode } from '../constants/languages';
import { testIDs } from '../constants/testIDs';
import { colors } from '../constants/theme';
import { tts } from '../services/tts';
import type { TurnDraft } from '../hooks/conversationReducer';
import CopyMenu from './CopyMenu';

interface Props {
  session: ConversationSession;
  /**
   * The current in-flight turn (not yet committed to `session.turns`).
   * Rendered as a non-interactive preview bubble below the committed turns.
   * Lifecycle:
   *   • `previewPhase === 'recording'`  — user is speaking; the bubble shows
   *     the on-device live transcript via `previewDraft.originalText` and
   *     **no** target half (translation hasn't started). `previewDraft.id`
   *     can be a synthetic placeholder since nothing binds to it.
   *   • `previewPhase === 'translating'` — Whisper has returned; the bubble
   *     shows the routed source text + a target half that's either the
   *     `previewTranslation` accumulator (streaming) or a "Translating…"
   *     placeholder (between TRANSCRIBED and the first token).
   *   • `previewPhase === null` / `previewDraft == null` — no preview.
   */
  previewDraft?: TurnDraft | null;
  previewTranslation?: string;
  previewPhase?: 'recording' | 'translating' | null;
  /**
   * Settings-driven: when true, render only the translated half of each
   * turn. The source half + divider are dropped — useful for live face-to-
   * face use where the user does not need their own words echoed back.
   */
  hideOriginal?: boolean;
}

function languageName(code: string): string {
  return findByCode(code)?.name ?? code.toUpperCase();
}

/** No-op handler — preview bubbles take no interaction callbacks. */
function noop() {
  /* intentionally empty */
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
  isPlaying,
  previewPhase = null,
  hideOriginal = false,
  onRequestCopy,
  onRequestSpeak,
}: {
  turn: ConversationTurn;
  alignRight: boolean;
  isPlaying: boolean;
  /**
   * `null` → a committed turn (full rendering, copy / speak gutter).
   * `'recording'` → user is still speaking; render the source half only
   *   (target half + divider suppressed — there is nothing to translate yet
   *   and a "Translating…" indicator would be a lie).
   * `'translating'` → Whisper returned; render source + target as usual,
   *   with the target half showing the streaming translation, falling back
   *   to a "Translating…" indicator while it is still empty.
   */
  previewPhase?: 'recording' | 'translating' | null;
  /** Drop the source half + divider; render only the translated body. */
  hideOriginal?: boolean;
  onRequestCopy: (turn: ConversationTurn) => void;
  onRequestSpeak: (turn: ConversationTurn) => void;
}) {
  // Recording-phase preview with hideOriginal enabled has nothing to show
  // (no source allowed, no translation yet). Skip it entirely so the user
  // doesn't see an empty bubble briefly.
  if (previewPhase === 'recording' && hideOriginal) return null;
  const isPreview = previewPhase !== null;
  const showTargetHalf = previewPhase !== 'recording';
  // Auto-detect routes within the chosen pair, so when a third language is
  // spoken the routed `sourceLang` is a fallback that does not match what
  // Whisper heard. Surface both rather than silently mislabel the turn.
  const detectedName = turn.detectedLang ? languageName(turn.detectedLang) : '';
  const showDetected = !!detectedName && turn.detectedLang !== turn.sourceLang;

  // Action gutter: tap-to-replay above copy. Stacked vertically so the
  // bubble keeps its `max-w-[85%]` and the gutter stays a narrow strip on
  // the opposite side, instead of stealing horizontal space.
  const actionButtons = (
    <View className="gap-1.5 self-end">
      <Pressable
        testID={testIDs.conversation.speakTurn(turn.id)}
        accessibilityRole="button"
        accessibilityLabel={
          isPlaying ? 'Stop reading turn' : 'Read turn translation aloud'
        }
        accessibilityState={{ selected: isPlaying }}
        onPress={() => onRequestSpeak(turn)}
        hitSlop={8}
        className="rounded-lg border border-neon/25 bg-surface px-2.5 py-1.5"
      >
        <Text className="font-mono text-[14px] leading-[14px] text-neon/80">
          {isPlaying ? '■' : '▶'}
        </Text>
      </Pressable>
      <Pressable
        testID={testIDs.copy.trigger(turn.id)}
        accessibilityRole="button"
        accessibilityLabel="Copy turn"
        onPress={() => onRequestCopy(turn)}
        hitSlop={8}
        className="rounded-lg border border-neon/25 bg-surface px-2.5 py-1.5"
      >
        <Text className="font-mono text-[14px] leading-[14px] text-neon/80">⎘</Text>
      </Pressable>
    </View>
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
      {hideOriginal ? null : (
        <>
          <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-fg-faint">
            {languageName(turn.sourceLang)}
            {showDetected ? (
              <Text className="text-neon/70">{`  ·  heard ${detectedName}`}</Text>
            ) : null}
          </Text>
          <Text className="mt-1 text-[15px] leading-5 text-fg">{turn.originalText}</Text>
          {/* The divider sits between the two halves. Drop it when only one
              half renders so the bubble does not trail an orphan rule. */}
          {showTargetHalf ? <View className="my-2 h-px bg-neon/15" /> : null}
        </>
      )}

      {showTargetHalf ? (
        <>
          <Text className="font-mono text-[10px] uppercase tracking-[1.5px] text-neon/70">
            {languageName(turn.targetLang)}
          </Text>
          {turn.translatedText ? (
            <Text className="mt-1 text-[15px] leading-5 text-neon">
              {turn.translatedText}
            </Text>
          ) : previewPhase === 'translating' ? (
            <View className="mt-1 flex-row items-center gap-2">
              <ActivityIndicator size="small" color={colors.neon} />
              <Text className="font-mono text-[11px] uppercase tracking-[1.5px] text-neon">
                Translating…
              </Text>
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );

  // Preview bubbles skip the action gutter: a streaming, not-yet-committed
  // turn has no stable id for copy / TTS to bind to.
  const gutter = isPreview ? null : actionButtons;
  return (
    <View className="mb-3 flex-row items-end gap-2">
      {alignRight ? (
        <>
          {gutter}
          <View className="flex-1 items-end">{bubble}</View>
        </>
      ) : (
        <>
          <View className="flex-1 items-start">{bubble}</View>
          {gutter}
        </>
      )}
    </View>
  );
}

export default function ConversationView({
  session,
  previewDraft = null,
  previewTranslation = '',
  previewPhase = null,
  hideOriginal = false,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const [copyTarget, setCopyTarget] = useState<ConversationTurn | null>(null);
  // Tap-to-replay: a single id at a time means tapping a different turn
  // implicitly stops the current one. Kept at this level (not inside
  // `TurnBubble`) so playback survives turn re-render and is a single
  // source of truth for which button shows the stop glyph.
  const [playingTurnId, setPlayingTurnId] = useState<string | null>(null);
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
  // The preview bubble appearing is a scroll trigger on par with a real
  // turn append: the user should see the in-flight turn arrive at the top of
  // the viewport. Subsequent growth of the preview (token-by-token) must NOT
  // re-scroll, so we only react to the null → non-null transition.
  const prevHasPreviewRef = useRef(false);
  const hasPreview = !!previewDraft;

  const handleRequestCopy = useCallback((turn: ConversationTurn) => {
    setCopyTarget(turn);
  }, []);

  const handleCloseCopy = useCallback(() => {
    setCopyTarget(null);
  }, []);

  const handleRequestSpeak = useCallback(
    async (turn: ConversationTurn) => {
      if (playingTurnId === turn.id) {
        tts.stop();
        return;
      }
      // Stop whatever is currently playing before starting the new turn,
      // otherwise expo-speech can briefly overlap two voices.
      tts.stop();
      setPlayingTurnId(turn.id);
      await tts.speak(turn.translatedText, turn.targetLang);
      // The user may have started a different turn before this one finished —
      // only clear the indicator if we are still the active turn.
      setPlayingTurnId(prev => (prev === turn.id ? null : prev));
    },
    [playingTurnId],
  );

  // Stop any active replay when the session swap unmounts the current turn
  // list, so a saved turn does not keep reading under the new session.
  useEffect(() => {
    return () => {
      tts.stop();
    };
  }, [session.id]);

  const handleContentSizeChange = useCallback(
    (_w: number, h: number) => {
      const sessionChanged = prevSessionIdRef.current !== session.id;
      const turnAppended =
        !sessionChanged && session.turns.length > prevTurnCountRef.current;
      const previewAppeared =
        !sessionChanged && !prevHasPreviewRef.current && hasPreview;

      if (sessionChanged) {
        // Loading a different session (or first mount with seeded turns) —
        // skip animation and reveal the most recent turn, matching chat-app
        // behaviour where reopening a thread shows the latest reply first.
        scrollRef.current?.scrollToEnd({ animated: false });
      } else if (turnAppended || previewAppeared) {
        // Scroll so the new turn's (or preview's) top edge sits at the top of
        // the viewport. The new content was appended below the previously-
        // measured content, so the previous total height equals the new
        // content's y offset.
        scrollRef.current?.scrollTo({
          y: prevContentHeightRef.current,
          animated: prevContentHeightRef.current > 0,
        });
      }

      prevSessionIdRef.current = session.id;
      prevTurnCountRef.current = session.turns.length;
      prevHasPreviewRef.current = hasPreview;
      prevContentHeightRef.current = h;
    },
    [session.id, session.turns.length, hasPreview],
  );

  // Empty thread hint — only when there's no committed turn AND no in-flight
  // preview, so the user is not staring at "tap to start" while the first
  // turn is mid-stream.
  if (session.turns.length === 0 && !hasPreview) {
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
              isPlaying={playingTurnId === turn.id}
              hideOriginal={hideOriginal}
              onRequestCopy={handleRequestCopy}
              onRequestSpeak={handleRequestSpeak}
            />
          ))}
          {previewDraft && previewPhase ? (
            <TurnBubble
              key="__preview__"
              turn={{
                id: previewDraft.id,
                sourceLang: previewDraft.sourceLang,
                targetLang: previewDraft.targetLang,
                detectedLang: previewDraft.detectedLang,
                originalText: previewDraft.originalText,
                translatedText: previewTranslation,
                createdAt: previewDraft.createdAt,
              }}
              alignRight={previewDraft.sourceLang === session.langB}
              isPlaying={false}
              previewPhase={previewPhase}
              hideOriginal={hideOriginal}
              onRequestCopy={noop}
              onRequestSpeak={noop}
            />
          ) : null}
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
