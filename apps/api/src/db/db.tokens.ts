import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export const DB = Symbol('DB');
export type Database = NodePgDatabase<typeof schema>;
export type TransactionClient = Parameters<Parameters<Database['transaction']>[0]>[0];
export type DrizzleClient = Database | TransactionClient;
