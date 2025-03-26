import { useEffect, useRef } from 'react';

export type Options<K, V> = {
  onClear?: (map: Map<K, V>) => void;
};

/**
 * Returns a map with its value cleared after each render, useful for
 * render-sensitive state managements.
 */
export let useRenderSession = <K, V>({
  onClear = (map) => map.clear(),
}: Options<K, V> = {}) => {
  let mapRef = useRef(new Map<K, V>());

  useEffect(() => onClear(mapRef.current));

  return mapRef.current;
};
