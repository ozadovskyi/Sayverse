import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import type { ConversationSession } from '../constants/conversation';
import {
  type HistoryEntry,
  type SingleShotEntry,
  entryId,
  entryUpdatedAt,
} from '../constants/historyEntry';
import { findByCode } from '../constants/languages';
import { testIDs } from '../constants/testIDs';
import {
  deleteSession,
  loadSessions,
} from '../storage/conversationStorage';
import {
  deleteSingleShot,
  loadSingleShots,
} from '../storage/singleShotStorage';
import BottomSheet from './BottomSheet';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelectSession: (session: ConversationSession) => void;
  onSelectSingleShot: (entry: SingleShotEntry) => void;
  /** Id of the conversation currently open — marked, so it reads as "live". */
  currentSessionId: string;
}

function languageName(code: string): string {
  return findByCode(code)?.name ?? code.toUpperCase();
}

/** Compact "time since" label — `now` is passed in to keep rendering pure. */
function relativeTime(ts: number, now: number): string {
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;
  const diff = Math.max(0, now - ts);
  if (diff < min) return 'just now';
  if (diff < hour) return `${Math.floor(diff / min)}m ago`;
  if (diff < day) return `${Math.floor(diff / hour)}h ago`;
  return `${Math.floor(diff / day)}d ago`;
}

function Chip({ label }: { label: string }) {
  return (
    <View className="rounded border border-neon/30 bg-neon/5 px-1.5">
      <Text className="font-mono text-[9px] uppercase tracking-[1.5px] text-neon">
        {label}
      </Text>
    </View>
  );
}

function ConversationRow({
  session,
  isCurrent,
  now,
  onSelect,
  onDelete,
}: {
  session: ConversationSession;
  isCurrent: boolean;
  now: number;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const last = session.turns[session.turns.length - 1];
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Pressable
        testID={testIDs.conversation.session(session.id)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${languageName(session.langA)} to ${languageName(
          session.langB,
        )} conversation`}
        onPress={onSelect}
        className="flex-1 rounded-xl border border-neon/20 bg-surface-input p-3.5"
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            <Chip label="Conversation" />
            <Text className="font-mono text-[11px] uppercase tracking-[2px] text-neon">
              {languageName(session.langA)} ⇄ {languageName(session.langB)}
            </Text>
          </View>
          {isCurrent ? (
            <Text className="font-mono text-[9px] uppercase tracking-[1.5px] text-neon/70">
              Current
            </Text>
          ) : null}
        </View>
        <Text className="mt-1 font-mono text-[10px] uppercase tracking-[1.5px] text-fg-faint">
          {session.turns.length} turn{session.turns.length === 1 ? '' : 's'} ·{' '}
          {relativeTime(session.updatedAt, now)}
        </Text>
        {last ? (
          <Text numberOfLines={1} className="mt-1.5 text-[13px] text-fg-muted">
            {last.originalText}
          </Text>
        ) : null}
      </Pressable>
      <Pressable
        testID={testIDs.conversation.sessionDeleteButton(session.id)}
        accessibilityRole="button"
        accessibilityLabel="Delete conversation"
        onPress={onDelete}
        className="rounded-xl border border-danger/40 px-3 py-3"
      >
        <Text className="font-mono text-xs uppercase tracking-[1px] text-danger">
          Del
        </Text>
      </Pressable>
    </View>
  );
}

function SingleShotRow({
  entry,
  now,
  onSelect,
  onDelete,
}: {
  entry: SingleShotEntry;
  now: number;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <View className="mb-3 flex-row items-center gap-2">
      <Pressable
        testID={testIDs.history.singleEntry(entry.id)}
        accessibilityRole="button"
        accessibilityLabel={`Open ${languageName(entry.sourceLang)} to ${languageName(
          entry.targetLang,
        )} translation`}
        onPress={onSelect}
        className="flex-1 rounded-xl border border-neon/20 bg-surface-input p-3.5"
      >
        <View className="flex-row items-center gap-2">
          <Chip label="Single" />
          <Text className="font-mono text-[11px] uppercase tracking-[2px] text-neon">
            {languageName(entry.sourceLang)} → {languageName(entry.targetLang)}
          </Text>
        </View>
        <Text className="mt-1 font-mono text-[10px] uppercase tracking-[1.5px] text-fg-faint">
          {relativeTime(entry.createdAt, now)}
        </Text>
        <Text numberOfLines={1} className="mt-1.5 text-[13px] text-fg-muted">
          {entry.originalText}
        </Text>
        <Text
          numberOfLines={1}
          className="mt-0.5 text-[13px] text-neon/80"
        >
          {entry.translatedText}
        </Text>
      </Pressable>
      <Pressable
        testID={testIDs.history.singleEntryDeleteButton(entry.id)}
        accessibilityRole="button"
        accessibilityLabel="Delete translation"
        onPress={onDelete}
        className="rounded-xl border border-danger/40 px-3 py-3"
      >
        <Text className="font-mono text-xs uppercase tracking-[1px] text-danger">
          Del
        </Text>
      </Pressable>
    </View>
  );
}

/**
 * Unified history browser — one sheet across single-shot translations and
 * conversation sessions, newest-first, with a chip per row marking the kind.
 * Replaces the earlier conversation-only history; the conversation testIDs
 * stay (the conversation entries are still here, alongside single-shots).
 */
export default function HistoryScreen({
  visible,
  onClose,
  onSelectSession,
  onSelectSingleShot,
  currentSessionId,
}: Props) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [singleShots, setSingleShots] = useState<SingleShotEntry[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    const [s, ss] = await Promise.all([loadSessions(), loadSingleShots()]);
    setSessions(s);
    setSingleShots(ss);
    setNow(Date.now());
  }, []);

  // Reload each time the sheet opens — entries may have been added since.
  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  // Merge the two stores into a single timeline sorted newest-first.
  const merged: HistoryEntry[] = useMemo(() => {
    const all: HistoryEntry[] = [
      ...singleShots.map(e => ({ ...e })),
      ...sessions.map(s => ({ kind: 'conversation' as const, session: s })),
    ];
    return all.sort((a, b) => entryUpdatedAt(b) - entryUpdatedAt(a));
  }, [singleShots, sessions]);

  const handleDeleteSession = useCallback(
    async (id: string) => {
      await deleteSession(id);
      await refresh();
    },
    [refresh],
  );

  const handleDeleteSingleShot = useCallback(
    async (id: string) => {
      await deleteSingleShot(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      closeLabel="Close history"
      testID={testIDs.conversation.historyModal}
      maxHeightClass="max-h-[75%]"
    >
      <Text className="mb-5 text-center font-mono text-base uppercase tracking-[3px] text-neon">
        History
      </Text>

      {merged.length === 0 ? (
        <Text
          testID={testIDs.conversation.historyEmpty}
          className="py-8 text-center font-mono text-xs uppercase tracking-[2px] text-fg-faint"
        >
          No saved translations yet
        </Text>
      ) : (
        <ScrollView className="mb-2">
          {merged.map(entry =>
            entry.kind === 'conversation' ? (
              <ConversationRow
                key={entryId(entry)}
                session={entry.session}
                isCurrent={entry.session.id === currentSessionId}
                now={now}
                onSelect={() => {
                  onSelectSession(entry.session);
                  onClose();
                }}
                onDelete={() => void handleDeleteSession(entry.session.id)}
              />
            ) : (
              <SingleShotRow
                key={entryId(entry)}
                entry={entry}
                now={now}
                onSelect={() => {
                  onSelectSingleShot(entry);
                  onClose();
                }}
                onDelete={() => void handleDeleteSingleShot(entry.id)}
              />
            ),
          )}
        </ScrollView>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close history"
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
