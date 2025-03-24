import { createMockClient, type MockClientOptions } from 'test-utils';
import { createSolidClient, type SolidClientOptions } from '../src';

export type TestClientOptions = {
  solid?: SolidClientOptions;
  client?: MockClientOptions;
};

export let createMockSolidClient = async (options?: TestClientOptions) => {
  let client = await createMockClient(options?.client);

  return createSolidClient(client, options?.solid);
};
