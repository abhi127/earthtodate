export const MAX_MAPS = 4;

export function canAddMap(mapCount) {
  return mapCount < MAX_MAPS;
}

export function canRemoveMap(mapCount, index) {
  if (index === 0) return false;
  return mapCount > 1 && index < mapCount;
}

export function nextMapCountOnSatelliteOpen(mapCount) {
  if (mapCount <= 1) return 2;
  return Math.min(mapCount, MAX_MAPS);
}

export function resolveLayout(mapCount, layoutMode) {
  if (mapCount <= 1) return 'single';
  if (mapCount === 2) return layoutMode === 'swipe' ? 'swipe' : 'compare';
  return 'grid';
}
