import type { CacheObject } from '../Cache';
import { isObject } from '../Utils';
import { $meta } from './meta';

/** These objects won't show up in JSON serialization. */
let skeletons = new WeakSet();

export let isSkeleton = (object: unknown) => {
  if (!isObject(object)) return false;

  let value = object as CacheObject;

  if (skeletons.has(value)) return true;

  let data = $meta(value)?.cache.data;

  if (!isObject(data)) return false;

  return skeletons.has(data);
};

/** Create data skeleton array/objects. */
export let createSkeleton = <T extends WeakKey>(fn: () => T) => {
  let skeleton = fn();
  skeletons.add(skeleton);
  return skeleton;
};
