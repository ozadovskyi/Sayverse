import React from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';

import { Language, LANGUAGES } from '../constants/languages';
import { testIDs } from '../constants/testIDs';

interface Props {
  source: Language;
  target: Language;
  onChangeSource: (lang: Language) => void;
  onChangeTarget: (lang: Language) => void;
  onSwap: () => void;
}

export default function LanguagePicker({
  source,
  target,
  onChangeSource,
  onChangeTarget,
  onSwap,
}: Props) {
  const [modal, setModal] = React.useState<'source' | 'target' | null>(null);

  const handleSelect = (lang: Language) => {
    if (modal === 'source') onChangeSource(lang);
    else if (modal === 'target') onChangeTarget(lang);
    setModal(null);
  };

  const selectedCode = modal === 'source' ? source.code : target.code;

  return (
    <View className="flex-row items-center justify-center gap-3 px-5 py-4">
      <LanguageButton
        testID={testIDs.language.sourceButton}
        accessibilityLabel={`Source language: ${source.name}`}
        language={source}
        onPress={() => setModal('source')}
      />

      <Pressable
        testID={testIDs.language.swapButton}
        accessibilityRole="button"
        accessibilityLabel="Swap languages"
        onPress={onSwap}
        className="h-11 w-11 items-center justify-center rounded-full border border-neon/40 bg-surface"
      >
        <Text className="text-base text-neon">⇄</Text>
      </Pressable>

      <LanguageButton
        testID={testIDs.language.targetButton}
        accessibilityLabel={`Target language: ${target.name}`}
        language={target}
        onPress={() => setModal('target')}
      />

      <Modal visible={modal !== null} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/70">
          <View className="max-h-[70%] rounded-t-3xl border-t border-neon/30 bg-surface px-4 pt-5">
            <Text className="mb-4 text-center font-mono text-sm uppercase tracking-[2px] text-fg-muted">
              {modal === 'source' ? 'Source language' : 'Target language'}
            </Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => {
                const selected = item.code === selectedCode;
                return (
                  <Pressable
                    testID={testIDs.language.option(item.code)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => handleSelect(item)}
                    className="flex-row items-center justify-between border-b border-neon/10 px-3 py-3.5"
                  >
                    <Text className={selected ? 'text-base text-neon' : 'text-base text-fg'}>
                      {item.name}
                    </Text>
                    <Text className="text-sm text-fg-faint">{item.nativeName}</Text>
                  </Pressable>
                );
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setModal(null)}
              className="items-center py-4"
            >
              <Text className="font-mono text-sm uppercase tracking-[2px] text-fg-muted">
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function LanguageButton({
  language,
  onPress,
  testID,
  accessibilityLabel,
}: {
  language: Language;
  onPress: () => void;
  testID: string;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      className="flex-1 items-center rounded-xl border border-neon/30 bg-surface p-3"
    >
      <Text className="text-base font-semibold text-fg">{language.name}</Text>
      <Text className="mt-0.5 text-xs text-fg-muted">{language.nativeName}</Text>
    </Pressable>
  );
}
