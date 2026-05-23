# Device-test findings — 2026-05-22 (iOS, iPhone 12 mini)

First iOS device-test pass on the ad-hoc build from the `preview` profile, immediately after Apple Developer enrollment + first `eas build --platform ios --profile preview`.

This is the second formal device-test round (the first produced PR #28). Same operating principle: discover manually, automate to protect. Findings collected here become the scope of a single bundled PR.

## Scope of this PR

Bug fixes:

1. **Result-card text clipped at top edge** — translation result card visibly chops the top half of the first visible line of long output; container/padding/scroll offset issue.
2. **Conversation cards have asymmetric left > right padding** — in CONVERSATION mode the dialogue cards sit slightly closer to the right edge than the left; visible on iPhone 12 mini.
3. **EdgeTrail follows a square instead of the device's rounded corners** — the perimeter trail draws along the rectangular bounding box, ignoring the iPhone's physical rounded display corners.
4. **EdgeTrail passes through the notch / Dynamic Island** — on devices with a top sensor cutout, the trail runs straight through the cutout area instead of detouring around it.

Feature additions (pulled into v1 from v2 backlog):

5. **Copy buttons on translation cards** — copy original / copy translation / copy both. Applies to both single-shot result and conversation turns.
6. **Network-drop resilience for the record→translate path** — if connectivity drops between recording end and translate call, preserve the transcribed/dictated text and surface a Retry button so the user does not lose their dictation.
7. **EdgeTrail circuit-routing rework** — PR #28 routed the trail *around* bottom controls (external detour). The intended Tron / circuit-board behaviour is the opposite: the line "enters" a button → the line itself disappears → glow traces the button's perimeter → glow re-collects to a point on the opposite side of the button → re-emerges as a line → continues along the perimeter. This is the "electricity through the component" effect, not "wire avoids the component."
8. **Unified history across Single + Conversation modes** — single shared History screen and one History entry point on the main UI. Each entry carries a `SINGLE` / `CONVERSATION` type marker. Storage refactored to a common entry format. Supersedes the v2-backlog design note about deferring single-shot history; v2 plan called for unification — we are doing the unified design directly in v1.

Investigation (deferred from this PR):

9. **Streaming translation** — translation result feels slower than expected. Switching to the OpenAI streaming API and progressively rendering into `TranslationCard` (token-by-token) would make the system feel responsive even when total time is similar — this is what ChatGPT does. **Deferred to a follow-up PR**: the change touches `services/openai.ts`, `App.tsx`, `useConversation`, and the animation in both `TranslationCard` and `ConversationView` (current slide-up triggers on each text change — would fire on every token). Scope warrants its own PR so the 8 fixes + history landed here can ship and be device-validated independently.

## Out of scope (already deferred, still deferred)

- Visual-regression testing (Vision-AI platforms) — per main plan, not justified at v1 polish stage; animation paths remain the weak case even with Vision-AI.
- AI-exploratory / agentic testing — same reasoning.
- Whisper transcription-accuracy eval (6th LLM-eval category) — still needs curated golden-audio corpus.

## Notes for implementation

- All EdgeTrail fixes (rounded corners, notch detour, circuit-routing rework) are native-only behaviour and are not CI-verifiable; they need device tuning.
- Unified history needs a storage schema migration from the current conversation-only schema; the migration must be one-way and tolerant of pre-migration data on first launch.
- Streaming translation, if landed, changes `services/openai.ts` from request/response to a streaming consumer and requires `TranslationCard` to render progressive text without flicker.
