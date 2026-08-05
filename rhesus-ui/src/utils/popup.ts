// Anchors a fixed-position popup next to the button that opened it, flipping
// to open upward when the button sits in the lower half of the viewport (e.g.
// the floating toolbar near the bottom of the screen) so the popup doesn't
// run off-screen.
export function anchorPopupStyle(rect: DOMRect, width: number): Record<string, string> {
  let left = rect.left + rect.width / 2 - width / 2
  left = Math.max(8, Math.min(left, window.innerWidth - width - 8))
  const spaceBelow = window.innerHeight - rect.bottom
  const spaceAbove = rect.top
  if (spaceBelow < spaceAbove) {
    return { bottom: `${window.innerHeight - rect.top + 8}px`, left: `${left}px`, width: `${width}px` }
  }
  return { top: `${rect.bottom + 8}px`, left: `${left}px`, width: `${width}px` }
}
