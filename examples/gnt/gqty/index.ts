/**
 * GQty: You can safely modify this file based on your needs.
 */

import { createLogger } from '@gqty/logger';
import {
  Cache,
  createClient,
  defaultResponseHandler,
  type QueryFetcher,
} from 'gqty';
import {
  type GeneratedSchema,
  generatedSchema,
  scalarsEnumsHash,
} from './schema.generated';

let queryFetcher: QueryFetcher = async function (
  { query, variables, operationName, extensions },
  fetchOptions
) {
  // Modify "https://rickandmortyapi.com/graphql" if needed
  let response = await fetch('https://rickandmortyapi.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables,
      operationName,
    }),
    mode: 'cors',
    ...fetchOptions,
  });

  return await defaultResponseHandler(response);
};

let cache = new Cache(
  undefined,
  /**
   * Default option is immediate cache expiry but keep it for 5 minutes,
   * allowing soft refetches in background.
   */
  {
    maxAge: 0,
    staleWhileRevalidate: 5 * 60 * 1000,
    normalization: true,
  }
);

export let client = createClient<GeneratedSchema>({
  schema: generatedSchema,
  scalars: scalarsEnumsHash,
  cache,
  fetchOptions: {
    fetcher: queryFetcher,
  },
});

createLogger(client).start();

// Core functions
export let { resolve, subscribe, schema } = client;

// Legacy functions
export let {
  query,
  mutation,
  mutate,
  subscription,
  resolved,
  refetch,
  track,
} = client;

export * from './schema.generated';
