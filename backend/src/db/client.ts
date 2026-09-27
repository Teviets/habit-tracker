import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../config/env.js';
import * as schema from './schema.js';

const queryClient = postgres(env.DATABASE_URL, {
  max: env.DB_POOL_SIZE,
  idle_timeout: 20,
  connect_timeout: 10,
  prepare: true,
  transform: { undefined: null },
});

export const db = drizzle(queryClient, { schema });
export const closeDatabase = () => queryClient.end({ timeout: 5 });
