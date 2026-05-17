import React from 'react';
import { Text, View } from 'react-native';

import { testIDs } from '../constants/testIDs';

interface Props {
  isOffline: boolean;
}

export default function OfflineBanner({ isOffline }: Props) {
  if (!isOffline) return null;

  return (
    <View
      testID={testIDs.offlineBanner}
      accessibilityRole="alert"
      accessibilityLabel="No internet connection"
      className="border-b border-danger/60 bg-danger/15 py-2"
    >
      <Text className="text-center font-mono text-[11px] uppercase tracking-[2px] text-danger">
        ▲ No connection
      </Text>
    </View>
  );
}
