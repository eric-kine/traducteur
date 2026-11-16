import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env';
import { prisma } from './config/prisma';
import { authRouter } from './modules/auth/auth.routes';
import { usersRouter } from './modules/users/users.routes';
import { instituteRouter } from './modules/institute/institute.routes';
import { schoolsRouter } from './modules/schools/schools.routes';
import { schoolSpecialtiesRouter, specialtiesRouter } from './modules/specialties/specialties.routes';
import { levelsRouter, schoolLevelsRouter } from './modules/levels/levels.routes';
import { errorHandler, notFoundHandler } from './common/middlewares/error-handler';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // IP réelle derrière un proxy (Render, Nginx…)
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/institute', instituteRouter);
  app.use('/api/schools/:schoolId/specialties', schoolSpecialtiesRouter);
  app.use('/api/schools/:schoolId/levels', schoolLevelsRouter);
  app.use('/api/schools', schoolsRouter);
  app.use('/api/specialties', specialtiesRouter);
  app.use('/api/levels', levelsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
