import path from 'node:path';
import fs from 'node:fs';
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
import { levelTeachingUnitsRouter, teachingUnitsRouter } from './modules/teaching-units/teaching-units.routes';
import { academicYearsRouter } from './modules/academic-years/academic-years.routes';
import { studentsRouter } from './modules/students/students.routes';
import { enrollmentsRouter } from './modules/enrollments/enrollments.routes';
import { teachersRouter } from './modules/teachers/teachers.routes';
import { assignmentsRouter, coverageRouter } from './modules/assignments/assignments.routes';
import { gradesRouter } from './modules/grades/grades.routes';
import { certificatesRouter, publicVerifyRouter } from './modules/certificates/certificates.routes';
import { syllabiRouter } from './modules/syllabi/syllabi.routes';
import { roomsRouter } from './modules/rooms/rooms.routes';
import { schedulesRouter, sessionsRouter, timeslotsRouter, timetablesRouter } from './modules/schedules/schedules.routes';
import { accountsRouter } from './modules/accounts/accounts.routes';
import { meRouter } from './modules/me/me.routes';
import { dashboardRouter } from './modules/dashboard/dashboard.routes';
import { errorHandler, notFoundHandler } from './common/middlewares/error-handler';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // IP réelle derrière un proxy (Render, Nginx…)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // blob: : photos des étudiants et documents PDF chargés via l'API puis affichés
          'img-src': ["'self'", 'data:', 'blob:'],
          'frame-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
  app.use(cors({ origin: env.CORS_ORIGIN.split(','), credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  });

  // Vérification publique des documents (QR code) : sans authentification
  app.use('/api/public/verify', publicVerifyRouter);
  app.use('/api/auth', authRouter);
  // Notes, résultats et relevés (chemins complets, monté avant les autres routeurs)
  app.use('/api', gradesRouter);
  app.use('/api', certificatesRouter);
  app.use('/api', syllabiRouter);
  app.use('/api', accountsRouter);
  app.use('/api/me', meRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/institute', instituteRouter);
  app.use('/api/schools/:schoolId/specialties', schoolSpecialtiesRouter);
  app.use('/api/schools/:schoolId/levels', schoolLevelsRouter);
  app.use('/api/schools', schoolsRouter);
  app.use('/api/specialties', specialtiesRouter);
  app.use('/api/levels/:levelId/teaching-units', levelTeachingUnitsRouter);
  app.use('/api/levels', levelsRouter);
  app.use('/api/teaching-units/:id/coverage', coverageRouter);
  app.use('/api/teaching-units', teachingUnitsRouter);
  app.use('/api/academic-years', academicYearsRouter);
  app.use('/api/students', studentsRouter);
  app.use('/api/enrollments', enrollmentsRouter);
  app.use('/api/teachers', teachersRouter);
  app.use('/api/assignments', assignmentsRouter);
  app.use('/api/rooms', roomsRouter);
  app.use('/api/timeslots', timeslotsRouter);
  app.use('/api/schedules', schedulesRouter);
  app.use('/api/schedule-sessions', sessionsRouter);
  app.use('/api/timetables', timetablesRouter);

  // Version « tout-en-un » (Render, Docker simple) : l'API sert aussi le site compilé.
  if (env.FRONTEND_DIR) {
    const dir = path.resolve(env.FRONTEND_DIR);
    const index = path.join(dir, 'index.html');
    if (!fs.existsSync(index)) throw new Error(`FRONTEND_DIR invalide : ${index} introuvable`);
    app.use('/assets', express.static(path.join(dir, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(dir, { index: false }));
    // Application monopage : toute adresse hors /api renvoie index.html
    app.get(/^(?!\/api\/).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache').sendFile(index);
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
