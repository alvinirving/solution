import type { CacheObject } from '.';

export let isCacheObject = (value: unknown): value is CacheObject => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return false;

  let obj = value as CacheObject;
  if (obj.__typename && typeof obj.__typename !== 'string') return false;

  return true;
};

export let isCacheObjectArray = (value: unknown): value is CacheObject[] =>
  Array.isArray(value) && value.every(isCacheObject);
