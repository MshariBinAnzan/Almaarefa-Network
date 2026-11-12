import { app } from './app.js';
import { db } from './config/db.js';
import { env } from './config/env.js';
import { seedDatabase } from './database/seed.js';

async function bootstrap() {
  try {
    await db.init();
    if (env.autoMigrate) {
      await db.runMigrations();
    }
    if (env.autoSeed) {
      await seedDatabase();
    }

    const server = app.listen(env.port, () => {
      console.log('==========================================================');
      console.log('🚀 Almaarefa Network Backend API is running!');
      console.log(`📡 Base URL:      http://localhost:${env.port}${env.apiPrefix}`);
      console.log(`🩺 Health Check:  http://localhost:${env.port}${env.apiPrefix}/health`);
      console.log(`🗄️  Database Mode: ${db.getMode().toUpperCase()}`);
      console.log(`🌍 Environment:   ${env.nodeEnv}`);
      console.log('==========================================================');
    });

    const shutdown = async (signal: string) => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      server.close(async () => {
        await db.close();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    console.error('Failed to bootstrap Almaarefa Network Backend:', err);
    process.exit(1);
  }
}

bootstrap();

