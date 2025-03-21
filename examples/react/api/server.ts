import FastifyNext from '@fastify/nextjs';
import Fastify from 'fastify';
import ms from 'ms';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { buildApp } from './graphql';

const app = Fastify({
  logger: true,
  pluginTimeout: ms('60 seconds'),
});

app.register(buildApp().fastifyPlugin);

console.log('> React example API server started.');

app
  .register(FastifyNext, {
    logLevel: 'error',
    dir: resolve(dirname(fileURLToPath(import.meta.url)), '../'),
  })
  .then(() => {
    if (!app.next) {
      console.error('Next.js could not be registered');
      process.exit(1);
    }
    try {
      app.next('/*');
    } catch (err) {
      console.error(err);
    }
  });

app.listen({ host: '0.0.0.0', port: 3000 }, (err) => {
  if (err) throw err;
});
