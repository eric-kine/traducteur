import { beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, as, createInstitute, createUser, loginAs, resetDb } from '../helpers';

let admin: ReturnType<typeof as>;
let token: string;
let schoolId: string;
let yearId: string;
let l1: string;
let gl: string;

const STUDENT = {
  firstName: 'Awa', lastName: 'Diallo', gender: 'F', birthDate: '2005-03-15', birthPlace: 'Dakar',
  guardianName: 'Moussa Diallo', guardianRelation: 'Père', guardianPhone: '+221 77 000 00 00',
};
const PNG = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

beforeEach(async () => {
  await resetDb();
  await createUser('ADMIN', 'admin@test.local');
  token = (await loginAs('admin@test.local')).token;
  admin = as(token);
  await createInstitute();
  schoolId = (await admin.post('/api/schools', { code: 'EIT', name: 'EIT' })).body.school.id;
  l1 = (await admin.post(`/api/schools/${schoolId}/levels`, { code: 'L1', name: 'Licence 1', cycle: 'LICENCE' })).body.level.id;
  gl = (await admin.post(`/api/schools/${schoolId}/specialties`, { code: 'GL', name: 'Génie Logiciel' })).body.specialty.id;
  yearId = (await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).body.academicYear.id;
});

// ---------------------------------------------------------------------------
describe('Années académiques', () => {
  it('la première année devient courante ; une seule année courante à la fois', async () => {
    const list1 = (await admin.get('/api/academic-years')).body.data;
    expect(list1[0]).toMatchObject({ label: '2026-2027', isCurrent: true, startDate: '2026-09-01' });

    const y2 = (await admin.post('/api/academic-years', { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-07-31', isCurrent: true })).body.academicYear;
    const all = (await admin.get('/api/academic-years')).body.data;
    expect(all.filter((y: { isCurrent: boolean }) => y.isCurrent).map((y: { id: string }) => y.id)).toEqual([y2.id]);
  });

  it('devient courante même si le formulaire envoie isCurrent: false, tant qu’aucune année n’est courante', async () => {
    await admin.patch(`/api/academic-years/${yearId}`, { label: '2025-2026', startDate: '2025-09-01', endDate: '2026-07-31' });
    await (await import('../../src/config/prisma')).prisma.academicYear.updateMany({ data: { isCurrent: false } });
    const y = await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31', isCurrent: false });
    expect(y.body.academicYear.isCurrent).toBe(true);
    const y3 = await admin.post('/api/academic-years', { label: '2027-2028', startDate: '2027-09-01', endDate: '2028-07-31', isCurrent: false });
    expect(y3.body.academicYear.isCurrent).toBe(false);
  });

  it('valide le libellé et les dates ; refuse un doublon', async () => {
    expect((await admin.post('/api/academic-years', { label: '2026-2028', startDate: '2026-09-01', endDate: '2027-07-31' })).status).toBe(400);
    expect((await admin.post('/api/academic-years', { label: '2028-2029', startDate: '2029-09-01', endDate: '2028-07-31' })).status).toBe(400);
    expect((await admin.post('/api/academic-years', { label: '2026-2027', startDate: '2026-09-01', endDate: '2027-07-31' })).status).toBe(409);
  });
});

// ---------------------------------------------------------------------------
describe('Étudiants', () => {
  it('génère un matricule ÉCOLE-ANNÉE-NUMÉRO et inscrit en même temps', async () => {
    const a = await admin.post('/api/students', { ...STUDENT, schoolId, enrollment: { academicYearId: yearId, levelId: l1, specialtyId: gl } });
    expect(a.status).toBe(201);
    expect(a.body.student).toMatchObject({ matricule: 'EIT-2026-00001', birthDate: '2005-03-15', guardianRelation: 'Père', hasPhoto: false });
    expect(a.body.student.currentEnrollment).toMatchObject({ status: 'INSCRIT', level: { code: 'L1' }, specialty: { code: 'GL' }, academicYear: { label: '2026-2027' } });

    const b = await admin.post('/api/students', { ...STUDENT, firstName: 'Moussa', schoolId });
    expect(b.body.student.matricule).toBe('EIT-2026-00002');
    expect(b.body.student.currentEnrollment).toBeNull();
  });

  it('valide les champs (âge, sexe, email du tuteur)', async () => {
    const res = await admin.post('/api/students', { ...STUDENT, schoolId, birthDate: '2024-01-01', gender: 'X', guardianEmail: 'nope' });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.error.details)).toEqual(expect.arrayContaining(['birthDate', 'gender', 'guardianEmail']));
  });

  it('refuse une inscription à un niveau d’une autre école', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    const foreignLevel = (await admin.post(`/api/schools/${other}/levels`, { code: 'B1', name: 'Bachelor 1', cycle: 'LICENCE' })).body.level.id;
    const res = await admin.post('/api/students', { ...STUDENT, schoolId, enrollment: { academicYearId: yearId, levelId: foreignLevel } });
    expect(res.status).toBe(400);
    expect(res.body.error.details.levelId).toBeDefined();
  });

  it('liste, recherche et filtre par niveau / année ; modifie ; supprime', async () => {
    const s = (await admin.post('/api/students', { ...STUDENT, schoolId, enrollment: { academicYearId: yearId, levelId: l1 } })).body.student;
    await admin.post('/api/students', { ...STUDENT, firstName: 'Ibrahima', lastName: 'Sow', schoolId });

    expect((await admin.get('/api/students')).body.total).toBe(2);
    expect((await admin.get('/api/students?search=diallo awa')).body.data[0].id).toBe(s.id);
    expect((await admin.get('/api/students?search=EIT-2026-00001')).body.total).toBe(1);
    expect((await admin.get(`/api/students?academicYearId=${yearId}&levelId=${l1}`)).body.total).toBe(1);

    expect((await admin.patch(`/api/students/${s.id}`, { phone: '770000000', status: 'SUSPENDU' })).body.student).toMatchObject({ phone: '770000000', status: 'SUSPENDU' });
    expect((await admin.delete(`/api/students/${s.id}`)).status).toBe(204);
    expect((await admin.get(`/api/students/${s.id}`)).status).toBe(404);
  });

  it('SCOLARITE limité à son école ; ENSEIGNANT sans accès', async () => {
    const other = (await admin.post('/api/schools', { code: 'ESC', name: 'ESC' })).body.school.id;
    await createUser('SCOLARITE', 'sco@t.local', { schoolId: other });
    const sco = as((await loginAs('sco@t.local')).token);
    expect((await sco.post('/api/students', { ...STUDENT, schoolId })).status).toBe(403);
    expect((await sco.post('/api/students', { ...STUDENT, schoolId: other })).status).toBe(201);
    expect((await sco.get('/api/students')).body.data.every((s: { school: { id: string } }) => s.school.id === other)).toBe(true);

    await createUser('ENSEIGNANT', 'prof@t.local');
    expect((await as((await loginAs('prof@t.local')).token).get('/api/students')).status).toBe(403);
  });

  it('photo : envoi, lecture, refus d’un faux fichier image', async () => {
    const s = (await admin.post('/api/students', { ...STUDENT, schoolId })).body.student;
    const up = await request(app).put(`/api/students/${s.id}/photo`).set('Authorization', `Bearer ${token}`).attach('photo', PNG, 'photo.png');
    expect(up.status).toBe(204);
    expect((await admin.get(`/api/students/${s.id}`)).body.student.hasPhoto).toBe(true);

    const img = await admin.get(`/api/students/${s.id}/photo`);
    expect(img.status).toBe(200);
    expect(img.headers['content-type']).toBe('image/png');

    const fake = await request(app).put(`/api/students/${s.id}/photo`).set('Authorization', `Bearer ${token}`)
      .attach('photo', Buffer.from('<script>alert(1)</script>'), { filename: 'evil.png', contentType: 'image/png' });
    expect(fake.status).toBe(400);
    expect((await request(app).get(`/api/students/${s.id}/photo`)).status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
describe('Inscriptions', () => {
  it('une seule inscription par année ; modification du statut', async () => {
    const s = (await admin.post('/api/students', { ...STUDENT, schoolId })).body.student;
    const e = await admin.post('/api/enrollments', { studentId: s.id, academicYearId: yearId, levelId: l1 });
    expect(e.status).toBe(201);
    expect((await admin.post('/api/enrollments', { studentId: s.id, academicYearId: yearId, levelId: l1 })).status).toBe(409);
    expect((await admin.patch(`/api/enrollments/${e.body.enrollment.id}`, { status: 'ADMIS', specialtyId: gl })).body.enrollment).toMatchObject({ status: 'ADMIS', specialty: { code: 'GL' } });
    expect((await admin.get(`/api/enrollments?academicYearId=${yearId}&levelId=${l1}`)).body.data).toHaveLength(1);
    expect((await admin.get(`/api/students/${s.id}/enrollments`)).body.data).toHaveLength(1);
    expect((await admin.delete(`/api/enrollments/${e.body.enrollment.id}`)).status).toBe(204);
  });
});

// ---------------------------------------------------------------------------
describe('Import CSV', () => {
  const csv = (lines: string[]) => Buffer.from(lines.join('\n'), 'utf8');
  const post = (file: Buffer, fields: Record<string, string>) => {
    let r = request(app).post('/api/students/import').set('Authorization', `Bearer ${token}`).attach('file', file, 'etudiants.csv');
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v);
    return r;
  };
  const FILE = csv([
    '﻿Nom;Prénom;Sexe;Date de naissance;Lieu de naissance;Email;Niveau;Spécialité',
    'Ndiaye;Fatou;F;12/01/2006;Thiès;fatou@mail.sn;L1;GL',
    'Sarr;Ousmane;Homme;2005-07-30;Dakar;;L1;',
    'Ba;Mariam;X;31/02/2006;Kaolack;pas-un-email;L9;',
    'Ndiaye;Fatou;F;12/01/2006;Thiès;;L1;GL',
  ]);

  it('vérification à blanc : rapport ligne par ligne, rien n’est enregistré', async () => {
    const res = await post(FILE, { schoolId, academicYearId: yearId, dryRun: 'true' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ dryRun: true, total: 4, valid: 2, errors: 1, duplicates: 1, imported: 0 });
    const bad = res.body.rows.find((r: { line: number }) => r.line === 4);
    expect(bad.errors.join(' ')).toMatch(/sexe/);
    expect(bad.errors.join(' ')).toMatch(/date_naissance/);
    expect(bad.errors.join(' ')).toMatch(/niveau.*L9/);
    expect(res.body.rows[3].status).toBe('duplicate');
    expect((await admin.get('/api/students')).body.total).toBe(0);
  });

  it('import réel : lignes valides enregistrées avec matricule et inscription', async () => {
    const res = await post(FILE, { schoolId, academicYearId: yearId, dryRun: 'false' });
    expect(res.body).toMatchObject({ imported: 2 });
    expect(res.body.rows[0].matricule).toMatch(/^EIT-2026-\d{5}$/);
    const list = (await admin.get(`/api/students?academicYearId=${yearId}`)).body;
    expect(list.total).toBe(2);
    const fatou = list.data.find((s: { firstName: string }) => s.firstName === 'Fatou');
    expect(fatou.currentEnrollment.specialty.code).toBe('GL');

    // Réimporter le même fichier : tout est détecté comme doublon
    const again = await post(FILE, { schoolId, academicYearId: yearId, dryRun: 'false' });
    expect(again.body).toMatchObject({ imported: 0, duplicates: 3 });
  });

  it('accepte le séparateur virgule ; exige les colonnes obligatoires et une année pour inscrire', async () => {
    const comma = await post(csv(['nom,prenom,sexe,date_naissance,lieu_naissance', 'Fall,Ali,M,01/01/2004,Saint-Louis']), { schoolId, dryRun: 'true' });
    expect(comma.body.valid).toBe(1);
    const missing = await post(csv(['nom;prenom', 'Fall;Ali']), { schoolId, dryRun: 'true' });
    expect(missing.status).toBe(400);
    expect(missing.body.error.message).toContain('sexe');
    const noYear = await post(csv(['nom;prenom;sexe;date_naissance;lieu_naissance;niveau', 'Fall;Ali;M;01/01/2004;Dakar;L1']), { schoolId, dryRun: 'true' });
    expect(noYear.body.rows[0].errors[0]).toContain('année académique');
  });
});

// ---------------------------------------------------------------------------
describe('Enseignants et affectations', () => {
  let teacherId: string;
  let ueId: string;

  beforeEach(async () => {
    const t = await admin.post('/api/teachers', {
      title: 'Dr', firstName: 'Ousmane', lastName: 'Fall', grade: 'Maître de conférences', specialtyField: 'Informatique',
      email: 'O.Fall@isp.sn', status: 'VACATAIRE', hourlyRate: 10000,
    });
    teacherId = t.body.teacher.id;
    ueId = (await admin.post(`/api/levels/${l1}/teaching-units`, { code: 'INF101', title: 'Algo', semester: 1, credits: 6, coefficient: 2, cmHours: 24, tdHours: 18, tpHours: 0 })).body.teachingUnit.id;
  });

  it('crée un enseignant avec numéro automatique ; email unique', async () => {
    const t = (await admin.get(`/api/teachers/${teacherId}`)).body.teacher;
    expect(t).toMatchObject({ employeeNumber: 'ENS-00001', email: 'o.fall@isp.sn', hourlyRate: 10000 });
    expect((await admin.post('/api/teachers', { firstName: 'X', lastName: 'Y', email: 'o.fall@isp.sn', status: 'PERMANENT' })).status).toBe(409);
    const t2 = await admin.post('/api/teachers', { firstName: 'Aïcha', lastName: 'Ba', email: 'a.ba@isp.sn', status: 'PERMANENT' });
    expect(t2.body.teacher.employeeNumber).toBe('ENS-00002');
  });

  it('affecte dans la limite du quota de l’UE et calcule la couverture', async () => {
    const ok = await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'CM', assignedHours: 24, isCoordinator: true });
    expect(ok.status).toBe(201);

    const t2 = (await admin.post('/api/teachers', { firstName: 'Aïcha', lastName: 'Ba', email: 'a.ba@isp.sn', status: 'PERMANENT' })).body.teacher.id;
    const td1 = await admin.post('/api/assignments', { teacherId: t2, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'TD', assignedHours: 10 });
    expect(td1.status).toBe(201);

    // TD : quota 18 h, 10 h déjà affectées → 9 h refusées
    const over = await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'TD', assignedHours: 9 });
    expect(over.status).toBe(400);
    expect(over.body.error.message).toContain('8 h encore disponibles');
    // TP : l'UE n'a pas d'heures de TP
    expect((await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'TP', assignedHours: 2 })).status).toBe(400);

    const cov = (await admin.get(`/api/teaching-units/${ueId}/coverage?academicYearId=${yearId}`)).body.coverage.byType;
    expect(cov.CM).toMatchObject({ quota: 24, assigned: 24, remaining: 0 });
    expect(cov.TD).toMatchObject({ quota: 18, assigned: 10, remaining: 8 });
  });

  it('refuse un doublon et des heures assurées > prévues ; un seul coordinateur', async () => {
    const a = (await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'CM', assignedHours: 12, isCoordinator: true })).body.assignment;
    expect((await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'CM', assignedHours: 2 })).status).toBe(409);
    expect((await admin.patch(`/api/assignments/${a.id}`, { completedHours: 20 })).status).toBe(400);

    const t2 = (await admin.post('/api/teachers', { firstName: 'Aïcha', lastName: 'Ba', email: 'a.ba@isp.sn', status: 'PERMANENT' })).body.teacher.id;
    await admin.post('/api/assignments', { teacherId: t2, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'TD', assignedHours: 18, isCoordinator: true });
    const list = (await admin.get(`/api/assignments?teachingUnitId=${ueId}&academicYearId=${yearId}`)).body.data;
    expect(list.filter((x: { isCoordinator: boolean }) => x.isCoordinator)).toHaveLength(1);
  });

  it('bilan de service : heures assurées en équivalent TD × taux horaire', async () => {
    const cm = (await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'CM', assignedHours: 24 })).body.assignment;
    const td = (await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'TD', assignedHours: 18 })).body.assignment;
    await admin.patch(`/api/assignments/${cm.id}`, { completedHours: 10 });
    await admin.patch(`/api/assignments/${td.id}`, { completedHours: 6 });
    const s = (await admin.get(`/api/teachers/${teacherId}/service?academicYearId=${yearId}`)).body.service;
    expect(s).toMatchObject({
      assignedTotal: 42, completedTotal: 16,
      completedTdEquivalent: 21, // 10 × 1,5 + 6
      amountDue: 210000,
    });
  });

  it('enseignant avec affectations : suppression refusée ; UE affectée non supprimable', async () => {
    await admin.post('/api/assignments', { teacherId, teachingUnitId: ueId, academicYearId: yearId, sessionType: 'CM', assignedHours: 5 });
    expect((await admin.delete(`/api/teachers/${teacherId}`)).status).toBe(409);
    expect((await admin.delete(`/api/teaching-units/${ueId}`)).status).toBe(409);
  });
});
