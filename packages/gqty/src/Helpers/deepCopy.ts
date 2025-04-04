import { parse, stringify } from 'flatted';

export let deepCopy = <T>(value: T): Readonly<T> =>
  Object.freeze(parse(stringify(value)));
