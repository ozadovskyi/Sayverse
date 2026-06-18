/**
 * Shared layout constants used by both the visual layout (bottom-bar
 * pill button, header row, KeyboardAvoidingView padding) and the
 * {@link EdgeTrail} animation that draws the perimeter line through
 * the centre of the bottom-bar pill.
 *
 * Best-practice rationale: the trail line is supposed to thread the
 * vertical centre of the TYPE pill on every device. The only safe way
 * to guarantee that without runtime measurement (which introduced
 * frame-by-frame jitter) is to derive both positions from the same
 * single source of truth. Bump `PILL_HEIGHT` or `PILL_BOTTOM_OFFSET`
 * here and the pill, the layout, and the trail all stay aligned.
 *
 * All values are in iOS points (≡ density-independent pixels).
 */

/**
 * Fixed pixel height of the bottom-bar pill controls (TYPE / Voice /
 * Retry / Dismiss). Set explicitly on `AnimatedPressable` so font
 * metric drift cannot change the actual rendered height, which is
 * what would invalidate the trail-through-centre calibration.
 */
export const PILL_HEIGHT = 26;

/**
 * Distance from the safe-area bottom edge to the bottom of the pill.
 * Applied as the bottom padding of the KeyboardAvoidingView so the
 * pill sits exactly this far above the home-indicator zone.
 */
export const PILL_BOTTOM_OFFSET = 8;

/**
 * Vertical offset of the trail's bottom edge above the safe-area
 * boundary. Derived: it sits at the pill's vertical centre.
 *
 *   trailBottomY = screenHeight - safeArea.bottom - TRAIL_BOTTOM_OFFSET
 *   pillCenterY  = screenHeight - safeArea.bottom - (PILL_BOTTOM_OFFSET + PILL_HEIGHT / 2)
 *
 * Setting `TRAIL_BOTTOM_OFFSET = PILL_BOTTOM_OFFSET + PILL_HEIGHT / 2`
 * makes the two equal on every device.
 */
export const TRAIL_BOTTOM_OFFSET = PILL_BOTTOM_OFFSET + PILL_HEIGHT / 2;

/**
 * Header row padding-top (Wordmark + HISTORY / SETTINGS row). The trail
 * draws its top edge flush with the safe-area boundary (TRAIL_TOP_INSET
 * = 0), so HEADER_TOP_OFFSET is the actual clearance between the line
 * and the header buttons.
 */
export const HEADER_TOP_OFFSET = 20;

/**
 * Trail's top-edge inset above the safe-area boundary. Kept at 0 so
 * the trail runs flush with the cutout, giving HEADER_TOP_OFFSET full
 * pixels of clearance to the buttons below.
 */
export const TRAIL_TOP_INSET = 0;

/** Side margin of the trail from the left/right screen edges. */
export const TRAIL_SIDE_INSET = 3;

/**
 * Max width of the primary content column. The app is Universal
 * (iPad). On iPad — and inside iPadOS 26's freely-resizable windows —
 * it renders at native iPad width; without a cap the header row,
 * language pickers and cards stretch edge-to-edge and read as
 * "crowded" (App Review Guideline 4 - Design). Centring the content at
 * this width preserves the portrait composition at any window size,
 * while the {@link EdgeTrail} still frames the full window.
 */
export const CONTENT_MAX_WIDTH = 640;

/**
 * Minimum top clearance for the header row. iPadOS 26 draws the system
 * Window Controls (close / resize handle) in the top-left of every
 * resizable window; on iPad the safe-area top inset is too small to
 * clear them, so the Wordmark collided with the controls. We push the
 * header down by at least this much — or the real safe-area top inset
 * on notched iPhones, whichever is larger — so neither device clips.
 * Refs: react-navigation #12638, Apple forum thread 800968.
 */
export const WINDOW_CONTROLS_CLEARANCE = 44;
