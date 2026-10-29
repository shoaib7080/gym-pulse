import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const DB = Symbol('DB');
export type Database = NodePgDatabase<typeof schema>;
