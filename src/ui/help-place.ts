// Where a field's explanation panel goes beside its "?" button (field-help.tsx), in viewport pixels: WebKit
// has no CSS anchor positioning, so the panel is placed by hand.

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Under the button, or above it when it fits only there; when it fits on neither side, on the side with
 * more room, as tall as that room (the panel scrolls inside), never over the button. Moved sideways to
 * keep `edge` px from the viewport's sides, and `gap` px from the button. `maxHeight` is the room on the
 * chosen side. `panel.height` is the panel's full height, not one already cut short.
 */
export const helpPanelPlace = (options: {
  readonly button: { readonly left: number; readonly top: number; readonly bottom: number };
  readonly panel: Size;
  readonly viewport: Size;
  readonly edge: number;
  readonly gap: number;
}): { readonly left: number; readonly top: number; readonly maxHeight: number } => {
  const { button, panel, viewport, edge, gap } = options;
  const below = button.bottom + gap;
  const roomBelow = Math.max(0, viewport.height - edge - below);
  const roomAbove = Math.max(0, button.top - gap - edge);
  const under = panel.height <= roomBelow || (panel.height > roomAbove && roomBelow >= roomAbove);
  const maxHeight = under ? roomBelow : roomAbove;
  return {
    left: Math.max(edge, Math.min(button.left, viewport.width - edge - panel.width)),
    top: under ? below : button.top - gap - Math.min(panel.height, maxHeight),
    maxHeight,
  };
};
