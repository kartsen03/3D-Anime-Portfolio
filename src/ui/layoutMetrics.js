// Shared between the HTML interface and the 3D camera: how much of the screen an open
// section sheet covers. The camera uses it to shift its view so the landmark you're
// reading about stays centred in the part of the screen the sheet leaves free.

export const SHEET_BREAKPOINT = 820 // px: below this width the sheet docks to the bottom

export function sheetCoverage(width, height) {
  if (width < SHEET_BREAKPOINT) {
    return { side: 'bottom', size: Math.round(height * 0.6) }
  }
  return { side: 'right', size: Math.round(Math.min(600, width * 0.44)) }
}
