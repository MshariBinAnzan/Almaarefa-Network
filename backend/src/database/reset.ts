import fs from 'fs';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { seedDatabase } from './seed.js';

async function run() {
  try {
    await db.close();
    if (fs.existsSync(env.pgliteDataDir)) {
      fs.rmSync(env.pgliteDataDir, { recursive: true, force: true });
    }
    await db.init();
    await db.runMigrations();
    await seedDatabase();
    console.log('Database reset, migrated, and seeded successfully.');
    await db.close();
  } catch (err) {
    console.error('Database reset failed:', err);
    await db.close();
    process.exit(1);
  }
}

run();

