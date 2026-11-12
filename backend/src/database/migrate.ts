import { db } from '../config/db.js';

async function run() {
  try {
    await db.init();
    await db.runMigrations();
    console.log(`Database migrations completed successfully (mode: ${db.getMode()}).`);
    await db.close();
  } catch (err) {
    console.error('Database migration failed:', err);
    await db.close();
    process.exit(1);
  }
}

run();

