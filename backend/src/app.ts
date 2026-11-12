import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import { env } from './config/env.js';
import { db } from './config/db.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import { sendSuccess } from './utils/response.js';

import authRouter from './modules/auth/auth.routes.js';
import profilesRouter from './modules/profiles/profiles.routes.js';
import verificationRouter from './modules/verification/verification.routes.js';
import {
  departmentsRouter,
  coursesRouter,
  classGroupsRouter,
} from './modules/academic/academic.routes.js';
import clubsRouter from './modules/clubs/clubs.routes.js';
import eventsRouter from './modules/events/events.routes.js';
import postsRouter from './modules/posts/posts.routes.js';
import {
  reportsRouter,
  adminRouter,
} from './modules/moderation/moderation.routes.js';
import uploadsRouter from './modules/uploads/uploads.routes.js';
import notificationsRouter from './modules/notifications/notifications.routes.js';

export function createApp(): Application {
  const app = express();

  // Security headers (allow cross-origin resource loading for avatars/uploads)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS configuration for Frontend integration (http://localhost:3000)
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          env.corsOrigins.includes('*') ||
          env.corsOrigins.includes(origin) ||
          env.nodeEnv !== 'production'
        ) {
          return callback(null, true);
        }
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    })
  );

  // Rate limiting (disabled in automated test environment)
  if (env.nodeEnv !== 'test') {
    const apiLimiter = rateLimit({
      windowMs: env.rateLimitWindowMs,
      max: env.rateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests, please try again later.',
        },
      },
    });
    app.use(env.apiPrefix, apiLimiter);
  }

  // Body parsers
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // Static uploads directory
  fs.mkdirSync(env.uploadStorageDir, { recursive: true });
  app.use('/uploads', express.static(env.uploadStorageDir));

  // Healthcheck endpoints
  const healthHandler = (_req: express.Request, res: express.Response) => {
    return sendSuccess(res, {
      service: 'Almaarefa Network Backend API',
      version: '1.0.0',
      status: 'healthy',
      databaseMode: db.getMode(),
      timestamp: new Date().toISOString(),
    });
  };
  app.get('/health', healthHandler);
  app.get(`${env.apiPrefix}/health`, healthHandler);

  // Mount API v1 domain routers
  const api = express.Router();
  api.use('/auth', authRouter);
  api.use('/profiles', profilesRouter);
  api.use('/verification', verificationRouter);
  api.use('/departments', departmentsRouter);
  api.use('/courses', coursesRouter);
  api.use('/class-groups', classGroupsRouter);
  api.use('/clubs', clubsRouter);
  api.use('/events', eventsRouter);
  api.use('/posts', postsRouter);
  api.use('/reports', reportsRouter);
  api.use('/admin', adminRouter);
  api.use('/uploads', uploadsRouter);
  api.use('/notifications', notificationsRouter);

  app.use(env.apiPrefix, api);

  // 404 & Central Error Handlers
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export const app = createApp();

