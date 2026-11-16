import { Router } from 'express';
import {
  createStudentSchema,
  importStudentsOptionsSchema,
  listStudentsQuerySchema,
  updateStudentSchema,
  uuidParam,
} from '@scolarix/shared';
import { authenticate } from '../../common/middlewares/authenticate';
import { authorize } from '../../common/middlewares/authorize';
import { validate } from '../../common/middlewares/validate';
import { memoryUpload } from '../../common/middlewares/upload';
import * as service from './students.service';
import { importStudents } from './students.import';
import { getForStudent } from '../enrollments/enrollments.service';

export const studentsRouter = Router();
// Données personnelles : réservées à l'administration et à la scolarité
studentsRouter.use(authenticate, authorize('ADMIN', 'SCOLARITE'));
const byId = validate(uuidParam('id'), 'params');

studentsRouter.get('/', validate(listStudentsQuerySchema, 'query'), async (req, res) => {
  res.json(await service.list(req.user!, res.locals.query));
});
studentsRouter.post('/', validate(createStudentSchema), async (req, res) => {
  res.status(201).json({ student: await service.create(req.user!, res.locals.body) });
});

// Import CSV (multipart : champ "file" + schoolId, academicYearId?, dryRun)
studentsRouter.post('/import', memoryUpload(2 * 1024 * 1024).single('file'), validate(importStudentsOptionsSchema), async (req, res) => {
  res.json(await importStudents(req.user!, req.file?.buffer, res.locals.body));
});

studentsRouter.get('/:id', byId, async (req, res) => {
  res.json({ student: await service.getById(req.user!, res.locals.params.id) });
});
studentsRouter.get('/:id/enrollments', byId, async (req, res) => {
  res.json({ data: await getForStudent(req.user!, res.locals.params.id) });
});
studentsRouter.patch('/:id', byId, validate(updateStudentSchema), async (req, res) => {
  res.json({ student: await service.update(req.user!, res.locals.params.id, res.locals.body) });
});
studentsRouter.delete('/:id', byId, async (req, res) => {
  await service.remove(req.user!, res.locals.params.id);
  res.status(204).end();
});

// Photo (2 Mo max, JPEG/PNG/WebP vérifiés par leur contenu)
studentsRouter.put('/:id/photo', byId, memoryUpload(2 * 1024 * 1024).single('photo'), async (req, res) => {
  await service.setPhoto(req.user!, res.locals.params.id, req.file?.buffer);
  res.status(204).end();
});
studentsRouter.get('/:id/photo', byId, async (req, res) => {
  const { file, mime } = await service.getPhoto(req.user!, res.locals.params.id);
  res.set({ 'Content-Type': mime, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' });
  res.sendFile(file);
});
studentsRouter.delete('/:id/photo', byId, async (req, res) => {
  await service.deletePhoto(req.user!, res.locals.params.id);
  res.status(204).end();
});
