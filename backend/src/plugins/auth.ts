import fastifyPlugin from 'fastify-plugin';

import { unauthorized } from '../lib/errors.js';

export const authPlugin = fastifyPlugin(async (app) => {
  app.decorate('authenticate', async (request) => {
    try {
      await request.jwtVerify();
      if (request.user.type !== 'access') throw unauthorized();
    } catch {
      throw unauthorized('Tu sesión no es válida o expiró.');
    }
  });
});
