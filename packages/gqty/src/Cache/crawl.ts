/* eslint-disable @typescript-eslint/no-explicit-any */

import { InfiniteFrailMap } from '../Helpers/InfiniteFrailMap';

/**
 * Stack-based deep crawl, avoiding recursions.
 */
export let crawl = (
  data: any,
  fn: (
    it: any,
    key: string | number,
    parent: Record<string, any> | any[]
  ) => [any, any, any] | void,
  maxIterations = 100000
) => {
  let seen = new InfiniteFrailMap<any, any>();
  let stack = new Set<[any, any, any]>([[data, 0, []]]);

  for (let [it, key, obj] of stack) {
    if (maxIterations-- < 0) {
      throw new Error('Maximum iterations reached.');
    }

    if (seen.get(it).get(key).has(obj)) continue;
    seen.get(it).get(key).set(obj, true);

    let ret = fn(it, key, obj);
    if (ret !== undefined) {
      stack.add(ret);
    }

    if (it === undefined) {
      delete obj[key];
    } else if (Array.isArray(it)) {
      for (let [k, v] of it.entries()) stack.add([v, k, it]);
    } else if (typeof it === 'object' && it !== null) {
      for (let [k, v] of Object.entries(it)) stack.add([v, k, it]);
    }
  }

  return data;
};

export let flattenObject = (
  obj: Record<string, unknown>,
  maxIterations = 100000
) => {
  let result: [string[], string | number | boolean | null][] = [];
  let stack = new Set<[string[], unknown]>([[[], obj]]);
  let seen = new Set();

  for (let [key, it] of stack) {
    if (maxIterations-- < 0) {
      throw new Error('Maximum iterations reached.');
    }

    if (it === undefined) continue;

    if (
      it === null ||
      typeof it === 'string' ||
      typeof it === 'number' ||
      typeof it === 'boolean'
    ) {
      result.push([key, it]);
    } else {
      if (seen.has(it)) continue;
      seen.add(it);

      if (Array.isArray(it)) {
        for (let [k, v] of it.entries()) stack.add([[...key, `${k}`], v]);
      } else if (typeof it === 'object') {
        for (let [k, v] of Object.entries(it))
          stack.add([[...key, `${k}`], v]);
      }
    }
  }

  return result;
};
