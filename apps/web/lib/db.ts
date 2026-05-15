import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;
export const db = url ? neon(url) : null;
