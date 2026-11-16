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

  // Vérification publique des documents (QR code) : sans authentification
  app.use('/api/public/verify', publicVerifyRouter);
  app.use('/api/auth', authRouter);
  // Notes, résultats et relevés (chemins complets, monté avant les autres routeurs)
  app.use('/api', gradesRouter);
  app.use('/api', certificatesRouter);
  app.use('/api', syllabiRouter);
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

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
