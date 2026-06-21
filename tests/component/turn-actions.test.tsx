import { render, screen } from '@testing-library/react-native';

import ConversationView from '../../components/ConversationView';
import type { ConversationSession } from '../../constants/conversation';
import { testIDs } from '../../constants/testIDs';

// Guards the ergonomics fix for the per-turn action gutter: the "loud" replay
// button must not be a pixel-twin of the benign Copy sitting right next to it
// (NN/g: consequential options next to benign ones need redundant visual
// distinction), and both must be a real touch target rather than the old
// cramped ~26px chips.

const session: ConversationSession = {
  id: 's1',
  langA: 'es',
  langB: 'ru',
  createdAt: 1000,
  updatedAt: 2000,
  turns: [
    {
      id: 't1',
      sourceLang: 'es',
      targetLang: 'ru',
      originalText: 'Hola',
      translatedText: 'Привет',
      createdAt: 1500,
    },
  ],
};

describe('Turn action gutter ergonomics', () => {
  it('renders replay and copy as distinct, finger-sized targets', () => {
    render(<ConversationView session={session} />);

    const replay = screen.getByTestId(testIDs.conversation.speakTurn('t1'));
    const copy = screen.getByTestId(testIDs.copy.trigger('t1'));

    // Enlarged, square touch targets (40px box, ~48px with hitSlop) — no
    // longer the old px-2.5/py-1.5 sliver.
    expect(replay.props.className).toContain('h-10 w-10');
    expect(copy.props.className).toContain('h-10 w-10');

    // Copy is the filled primary; idle replay is a recessed outline. The two
    // must not share a fill, or the meeting-misfire risk is back.
    expect(copy.props.className).toContain('bg-neon/10');
    expect(replay.props.className).toContain('bg-transparent');
    expect(replay.props.className).not.toContain('bg-neon/10');
  });
});
