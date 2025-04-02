import type { Cache } from '../Cache';
import type { Selection } from '../Selection';

let pendingSelections = new Map<Cache, Map<string, Set<Set<Selection>>>>();

export let addSelections = (
  cache: Cache,
  key: string,
  selections: Set<Selection>
) => {
  if (!pendingSelections.has(cache)) {
    pendingSelections.set(cache, new Map());
  }

  let selectionsByKey = pendingSelections.get(cache)!;

  if (!selectionsByKey.has(key)) {
    selectionsByKey.set(key, new Set());
  }

  return selectionsByKey.get(key)!.add(selections);
};

export let getSelectionsSet = (cache: Cache, key: string) =>
  pendingSelections.get(cache)?.get(key);

export let delSelectionSet = (cache: Cache, key: string) =>
  pendingSelections.get(cache)?.delete(key) ?? false;

export let popSelectionsSet = (cache: Cache, key: string) => {
  let result = getSelectionsSet(cache, key);

  delSelectionSet(cache, key);

  return result;
};
