import { e2eTts, IS_E2E } from './e2e';

describe('the E2E seam', () => {
  it('is OFF unless EXPO_PUBLIC_E2E is explicitly set', () => {
    // The unit environment has no EXPO_PUBLIC_E2E, exactly like a production
    // build. This guards the worst-case regression: if the default ever
    // flipped, real builds would serve canned fixture data to users.
    expect(IS_E2E).toBe(false);
  });

  it('e2eTts.speak resolves and yields no value', async () => {
    await expect(e2eTts.speak('hola', 'es')).resolves.toBeUndefined();
  });

  it('e2eTts.stop is a no-op that does not throw', () => {
    expect(() => e2eTts.stop()).not.toThrow();
  });
});
