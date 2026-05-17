import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { ConversationSession } from '../constants/conversation';
import { findByCode } from '../constants/languages';
import { testIDs } from '../constants/testIDs';
import { deleteSession, loadSessions } from '../storage/conversationStorage';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (session: ConversationSession) => void;
  /** Id of the session currently open — marked, so it reads as "live". */
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

/** One session row — language pair, turn count, age, and a snippet. */
function SessionRow({
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
          <Text className="font-mono text-[11px] uppercase tracking-[2px] text-neon">
            {languageName(session.langA)} ⇄ {languageName(session.langB)}
          </Text>
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

/**
 * History browser — a modal listing every persisted conversation, newest
 * first. Tapping a row restores that session; the bin button deletes it.
 */
export default function ConversationHistory({
  visible,
  onClose,
  onSelect,
  currentSessionId,
}: Props) {
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [now, setNow] = useState(() => Date.now());

  const refresh = useCallback(async () => {
    setSessions(await loadSessions());
    setNow(Date.now());
  }, []);

  // Reload each time the modal opens — turns may have been added since.
  useEffect(() => {
    if (visible) void refresh();
  }, [visible, refresh]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteSession(id);
      await refresh();
    },
    [refresh],
  );

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/70">
        <View
          testID={testIDs.conversation.historyModal}
          className="max-h-[75%] rounded-t-3xl border-t border-neon/30 bg-surface px-5 pb-10 pt-5"
        >
          <Text className="mb-5 text-center font-mono text-base uppercase tracking-[3px] text-neon">
            History
          </Text>

          {sessions.length === 0 ? (
            <Text
              testID={testIDs.conversation.historyEmpty}
              className="py-8 text-center font-mono text-xs uppercase tracking-[2px] text-fg-faint"
            >
              No saved conversations yet
            </Text>
          ) : (
            <ScrollView className="mb-2">
              {sessions.map(session => (
                <SessionRow
                  key={session.id}
                  session={session}
                  isCurrent={session.id === currentSessionId}
                  now={now}
                  onSelect={() => {
                    onSelect(session);
                    onClose();
                  }}
                  onDelete={() => void handleDelete(session.id)}
                />
              ))}
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
        </View>
      </View>
    </Modal>
  );
}
