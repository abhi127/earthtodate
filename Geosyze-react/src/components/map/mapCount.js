export const MAX_MAPS = 4;

export function canAddMap(mapCount) {
  return mapCount < MAX_MAPS;
}

export function resolveLayout(mapCount, layoutMode) {
  if (mapCount <= 1) return 'single';
  if (mapCount === 2) return layoutMode === 'swipe' ? 'swipe' : 'compare';
  return 'grid';
}
