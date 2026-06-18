import { getDb } from '../server/db.ts';
import { users } from '../drizzle/schema.ts';

const db = (await getDb());
const all = await db.select().from(users);
console.log(JSON.stringify(all, null, 2));
process.exit(0);
