import { FastifyInstance } from 'fastify';

import { authRoutes } from './auth.js';
import { chatRoutes } from './chat.js';
import { groupRoutes } from './groups.js';
import { habitGroupRoutes } from './habitGroups.js';
import { habitRoutes } from './habits.js';
import { healthRoutes } from './health.js';
import { postRoutes } from './posts.js';
import { statsRoutes } from './stats.js';
import { userRoutes } from './users.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(authRoutes, { prefix: '/v1' });
  await app.register(userRoutes, { prefix: '/v1' });
  await app.register(habitRoutes, { prefix: '/v1' });
  await app.register(habitGroupRoutes, { prefix: '/v1' });
  await app.register(postRoutes, { prefix: '/v1' });
  await app.register(groupRoutes, { prefix: '/v1' });
  await app.register(chatRoutes, { prefix: '/v1' });
  await app.register(statsRoutes, { prefix: '/v1' });
}
