import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import * as Clipboard from 'expo-clipboard';

import CopyMenu from '../../components/CopyMenu';
import { testIDs } from '../../constants/testIDs';

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
}));

const ORIGINAL = 'Hola mundo';
const TRANSLATION = 'Hello world';

function renderMenu(props: Partial<React.ComponentProps<typeof CopyMenu>> = {}) {
  const onClose = jest.fn();
  render(
    <CopyMenu
      visible
      onClose={onClose}
      originalText={ORIGINAL}
      translatedText={TRANSLATION}
      {...props}
    />,
  );
  return { onClose };
}

/** Press an option and flush the awaited Clipboard write. */
async function pressOption(testID: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
}

describe('CopyMenu', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(Clipboard.setStringAsync).mockClear();
    jest
      .spyOn(AccessibilityInfo, 'announceForAccessibility')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('copies just the translation', async () => {
    renderMenu();
    await pressOption(testIDs.copy.translation);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(TRANSLATION);
  });

  it('copies just the original', async () => {
    renderMenu();
    await pressOption(testIDs.copy.original);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(ORIGINAL);
  });

  it('copies original and translation together', async () => {
    renderMenu();
    await pressOption(testIDs.copy.both);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith(
      `${ORIGINAL}\n\n${TRANSLATION}`,
    );
  });

  it('confirms inline, announces for screen readers, then auto-closes', async () => {
    const { onClose } = renderMenu();
    await pressOption(testIDs.copy.translation);

    // The tapped option flips to a "Copied" confirmation in place …
    expect(screen.getByText('✓ Copied')).toBeOnTheScreen();
    // … and the change is announced rather than left silent.
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(
      'Copied to clipboard',
    );
    // The sheet stays a beat so the confirmation is readable, then dismisses.
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(900);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('marks the translation option as the primary (accented) action', () => {
    renderMenu();
    const translation = screen.getByTestId(testIDs.copy.translation);
    const both = screen.getByTestId(testIDs.copy.both);
    // The accent fill lives on "Copy translation", not "Copy both".
    expect(translation.props.className).toContain('bg-neon/10');
    expect(both.props.className).not.toContain('bg-neon/10');
  });
});
