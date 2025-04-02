import type { BaseGeneratedSchema } from '..';
import { GQtyError } from '../../Error';
import type { Selection } from '../../Selection';
import type { CreateLegacyMethodOptions } from './client';

export type LegacyTrackCallType = 'initial' | 'cache_change';

export interface LegacyTrackCallInfo {
  type: LegacyTrackCallType;
}

export interface LegacyTrackOptions {
  onError?: ((err: GQtyError) => void) | undefined;

  operationName?: string;

  /** Refetch on initial call */
  refetch?: boolean;
}

export interface LegacyTrack {
  <TData>(
    callback: (info: LegacyTrackCallInfo) => TData,
    options?: LegacyTrackOptions
  ): {
    stop: () => void;
    selections: Set<Selection>;
    data: { current: TData | undefined };
  };
}

export let createLegacyTrack = <
  TSchema extends BaseGeneratedSchema = BaseGeneratedSchema,
>({
  cache,
  context: globalContext,
  resolvers: { createResolver },
  subscribeLegacySelections,
}: CreateLegacyMethodOptions<TSchema>) => {
  let track: LegacyTrack = (
    fn,
    { onError, operationName, refetch = false } = {}
  ) => {
    let trackedSelections = new Set<Selection>();
    let { context, selections, subscribe } = createResolver({
      cachePolicy: refetch ? 'no-cache' : 'default',
      operationName,
    });
    let resolutionCache = refetch ? context.cache : cache;
    let dataFn = (info: LegacyTrackCallInfo) => {
      globalContext.cache = resolutionCache;

      try {
        return fn(info);
      } finally {
        globalContext.cache = cache;
      }
    };
    let unsubscribe = subscribeLegacySelections((selection, cache) => {
      context.select(selection, cache);
    });
    let data = { current: dataFn({ type: 'initial' }) };

    for (let selection of selections) {
      trackedSelections.add(selection);
    }

    context.subscribeSelect((selection) => {
      trackedSelections.add(selection);
    });

    unsubscribe();

    let stop = subscribe({
      onError(error) {
        let theError = GQtyError.create(error);

        if (onError) {
          onError(theError);
        } else {
          throw theError;
        }
      },
      onNext() {
        data.current = dataFn({ type: 'cache_change' });
      },
    });

    return { data, selections: trackedSelections, stop };
  };

  return track;
};
