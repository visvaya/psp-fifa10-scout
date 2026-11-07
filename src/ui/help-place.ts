// Where a field's explanation panel goes beside its "?" button (field-help.tsx), in viewport pixels: WebKit
// has no CSS anchor positioning, so the panel is placed by hand.

interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Under the button, or above it when it fits only there; moved sideways to keep `edge` px from the
 * viewport's sides, and `gap` px from the button.
 */
export const helpPanelPlace = (options: {
  readonly button: { readonly left: number; readonly top: number; readonly bottom: number };
  readonly panel: Size;
  readonly viewport: Size;
  readonly edge: number;
  readonly gap: number;
}): { readonly left: number; readonly top: number } => {
  const { button, panel, viewport, edge, gap } = options;
  const below = button.bottom + gap;
  const above = button.top - gap - panel.height;
  const fitsBelow = below + panel.height <= viewport.height - edge;
  return {
    left: Math.max(edge, Math.min(button.left, viewport.width - edge - panel.width)),
    top: fitsBelow || above < edge ? below : above,
  };
};
