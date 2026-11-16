/**
 * ═══════════════════════════════════════════════════════════════════════
 *  DONNÉES DE DÉMONSTRATION — à lancer sur une base VIDE (après les migrations)
 *    npm run db:seed:demo -w backend
 * ═══════════════════════════════════════════════════════════════════════
 * Toutes les personnes et tous les établissements sont fictifs.
 * Les données passent par les services de l'application (numérotation,
 * calculs, générateur d'emploi du temps…) : elles sont donc cohérentes.
 *
 * Comptes créés (mot de passe commun : Demo12345)
 *   admin@demo.scolarix.local       ADMIN
 *   scolarite@demo.scolarix.local   SCOLARITE (école EIT)
 *   o.fall@demo.scolarix.local      ENSEIGNANT (responsable INF101)
 *   a.ba@demo.scolarix.local        ENSEIGNANT
 *   awa.diallo@demo.scolarix.local  ETUDIANT (EIT · Licence 1 · GL, résultats délibérés)
 */
import { prisma } from '../src/config/prisma';
import { hashPassword } from '../src/modules/auth/password';
import type { AuthUser } from '../src/common/types';
import * as students from '../src/modules/students/students.service';
import * as assignments from '../src/modules/assignments/assignments.service';
import * as grades from '../src/modules/grades/grades.service';
import * as results from '../src/modules/grades/results.service';
import * as schedules from '../src/modules/schedules/schedules.service';
import * as certificates from '../src/modules/certificates/certificates.service';
import * as academicYears from '../src/modules/academic-years/academic-years.service';
import { saveSyllabus } from '../src/modules/syllabi/syllabi.service';
import { closePdfBrowser } from '../src/pdf/pdf.service';

const PASSWORD = 'Demo12345';
const DOMAIN = 'demo.scolarix.local';
const YEAR = '2026-2027';

// Générateur pseudo-aléatoire déterministe : la démo est identique à chaque installation
let seed = 2026;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const note = (mean: number, spread = 4) => Math.max(0, Math.min(20, Math.round((mean + (rnd() - 0.5) * 2 * spread) * 2) / 2));

const log = (s: string) => console.log(`  ✔ ${s}`);

async function main() {
  if (await prisma.school.count()) {
    console.error('❌ La base contient déjà des écoles : lancez la démo sur une base vide (voir README « Données de démonstration »).');
    process.exit(1);
  }
  console.log('🌱 Création des données de démonstration…');
  const hash = await hashPassword(PASSWORD);

  // ---- Institut, comptes, année ----
  const inst = (await prisma.institute.findFirst()) ?? (await prisma.institute.create({ data: { name: 'x' } }));
  await prisma.institute.update({
    where: { id: inst.id },
    data: { name: 'Institut Supérieur de Démonstration', acronym: 'ISD', address: '12 avenue des Écoles', city: 'Dakar', country: 'Sénégal', phone: '+221 33 000 00 00', email: `contact@${DOMAIN}`, directorName: 'Pr Mariama Ndiaye' },
  });
  const user = (email: string, firstName: string, lastName: string, role: 'ADMIN' | 'SCOLARITE' | 'ENSEIGNANT' | 'ETUDIANT', schoolId: string | null = null) =>
    prisma.user.upsert({ where: { email }, update: {}, create: { email, firstName, lastName, role, passwordHash: hash, schoolId } });
  const adminUser = await user(`admin@${DOMAIN}`, 'Admin', 'Démo', 'ADMIN');
  const admin: AuthUser = { id: adminUser.id, email: adminUser.email, role: 'ADMIN', schoolId: null };
  const year = await academicYears.create({ label: YEAR, startDate: '2026-09-01', endDate: '2027-07-31', isCurrent: true });
  await schedules.getTimeslots();
  log(`institut, compte administrateur, année ${YEAR}`);

  // ---- Écoles, spécialités, niveaux ----
  const school = (code: string, name: string, directorName: string) => prisma.school.create({ data: { code, name, directorName, instituteId: inst.id } });
  const eit = await school('EIT', "École d'Ingénieurs et de Technologie", 'Dr Ousmane Fall');
  const esc = await school('ESC', 'École Supérieure de Commerce', 'Mme Aïssatou Sy');
  await user(`scolarite@${DOMAIN}`, 'Fatou', 'Sarr', 'SCOLARITE', eit.id);
  const sp = async (schoolId: string, code: string, name: string, diplomaTitle: string) => prisma.specialty.create({ data: { schoolId, code, name, diplomaTitle } });
  const gl = await sp(eit.id, 'GL', 'Génie Logiciel', 'Licence en Génie Logiciel');
  const rt = await sp(eit.id, 'RT', 'Réseaux et Télécoms', 'Licence en Réseaux et Télécommunications');
  const fin = await sp(esc.id, 'FIN', 'Finance', 'Bachelor Finance');
  const mkt = await sp(esc.id, 'MKT', 'Marketing', 'Bachelor Marketing digital');
  const lvl = (schoolId: string, code: string, name: string, order: number) => prisma.level.create({ data: { schoolId, code, name, order, cycle: 'LICENCE' } });
  const l1 = await lvl(eit.id, 'L1', 'Licence 1', 1);
  await lvl(eit.id, 'L2', 'Licence 2', 2);
  await lvl(eit.id, 'L3', 'Licence 3', 3);
  const b1 = await lvl(esc.id, 'B1', 'Bachelor 1', 1);
  await lvl(esc.id, 'B2', 'Bachelor 2', 2);
  log('2 écoles, 4 spécialités, 5 niveaux');

  // ---- UE (volumes, pondérations, contenu) ----
  type U = [code: string, title: string, sem: number, credits: number, coef: number, cm: number, td: number, tp: number, w: [number, number, number], specialtyId?: string];
  const mkUe = ([code, title, semester, credits, coefficient, cmHours, tdHours, tpHours, [ccWeight, examWeight, tpWeight], specialtyId]: U, levelId: string) =>
    prisma.teachingUnit.create({
      data: {
        code, title, semester, credits, coefficient, cmHours, tdHours, tpHours, totalHours: cmHours + tdHours + tpHours,
        paidHours: cmHours * 1.5 + tdHours + tpHours, ccWeight, examWeight, tpWeight, levelId, specialtyId: specialtyId ?? null,
        objectives: `Maîtriser les notions fondamentales de « ${title} ».\n- Appliquer les méthodes vues en cours\n- Résoudre des problèmes types`,
        prerequisites: 'Niveau baccalauréat scientifique ou équivalent.',
        bibliography: 'Manuel de référence du cours\nFiches de TD distribuées en séance',
      },
    });
  const eitUnits = await Promise.all(([
    ['INF101', 'Algorithmique et structures de données', 1, 6, 3, 30, 18, 12, [30, 50, 20]],
    ['MAT101', 'Analyse mathématique', 1, 6, 3, 28, 28, 0, [40, 60, 0]],
    ['ANG101', 'Anglais technique', 1, 3, 1, 0, 28, 0, [50, 50, 0]],
    ['GL103', 'Développement web', 1, 5, 2, 14, 0, 28, [40, 30, 30], gl.id],
    ['RT103', 'Administration réseau', 1, 5, 2, 14, 0, 28, [40, 30, 30], rt.id],
    ['INF102', 'Programmation orientée objet', 2, 6, 3, 28, 14, 28, [30, 50, 20]],
    ['MAT102', 'Algèbre linéaire', 2, 6, 3, 28, 28, 0, [40, 60, 0]],
    ['COM101', 'Techniques de communication', 2, 3, 1, 0, 28, 0, [60, 40, 0]],
    ['GL201', 'Bases de données', 2, 5, 2, 14, 14, 28, [30, 40, 30], gl.id],
    ['RT201', 'Systèmes et réseaux', 2, 5, 2, 14, 14, 28, [30, 40, 30], rt.id],
  ] as U[]).map((u) => mkUe(u, l1.id)));
  const escUnits = await Promise.all(([
    ['ECO101', 'Introduction à l’économie', 1, 6, 3, 28, 14, 0, [40, 60, 0]],
    ['CPT101', 'Comptabilité générale', 1, 6, 3, 28, 28, 0, [40, 60, 0]],
    ['FIN101', 'Mathématiques financières', 1, 5, 2, 14, 28, 0, [40, 60, 0], fin.id],
    ['MKT101', 'Fondamentaux du marketing', 1, 5, 2, 28, 14, 0, [40, 60, 0], mkt.id],
    ['DRT101', 'Droit des affaires', 2, 5, 2, 28, 0, 0, [0, 100, 0]],
  ] as U[]).map((u) => mkUe(u, b1.id)));
  const ue = (code: string) => [...eitUnits, ...escUnits].find((u) => u.code === code)!;
  log(`${eitUnits.length + escUnits.length} unités d'enseignement`);

  // ---- Salles ----
  await prisma.room.createMany({ data: [
    { code: 'AMPHI-A', name: 'Amphithéâtre A', capacity: 200, supportedTypes: ['CM', 'TD'], instituteId: inst.id },
    { code: 'AMPHI-B', name: 'Amphithéâtre B', capacity: 120, supportedTypes: ['CM', 'TD'], instituteId: inst.id },
    { code: 'B101', capacity: 40, supportedTypes: ['TD'], instituteId: inst.id },
    { code: 'B102', capacity: 40, supportedTypes: ['TD'], instituteId: inst.id },
    { code: 'LAB-1', name: 'Laboratoire informatique', capacity: 30, supportedTypes: ['TP'], instituteId: inst.id },
    { code: 'LAB-2', name: 'Laboratoire réseaux', capacity: 30, supportedTypes: ['TP'], instituteId: inst.id },
  ] });
  log('6 salles');

  // ---- Enseignants (+ comptes pour 2 d'entre eux) ----
  type T = [title: string, first: string, last: string, grade: string, field: string, status: 'PERMANENT' | 'VACATAIRE', rate: number, email: string, account?: boolean];
  const teachers = new Map<string, string>();
  let n = 0;
  for (const [title, firstName, lastName, grade, specialtyField, status, hourlyRate, email, account] of [
    ['Dr', 'Ousmane', 'Fall', 'Maître de conférences', 'Informatique', 'PERMANENT', 12000, 'o.fall', true],
    ['Mme', 'Aïcha', 'Ba', 'Maître-assistante', 'Mathématiques', 'PERMANENT', 10000, 'a.ba', true],
    ['M.', 'Ibrahima', 'Sow', 'Ingénieur', 'Réseaux', 'VACATAIRE', 9000, 'i.sow'],
    ['Mme', 'Khady', 'Diop', 'Assistante', 'Génie logiciel', 'VACATAIRE', 9000, 'k.diop'],
    ['M.', 'John', 'Mensah', 'Professeur certifié', 'Anglais', 'VACATAIRE', 8000, 'j.mensah'],
    ['Pr', 'Cheikh', 'Ndiaye', 'Professeur', 'Économie', 'PERMANENT', 15000, 'c.ndiaye'],
    ['Mme', 'Rokhaya', 'Gueye', 'Expert-comptable', 'Comptabilité', 'VACATAIRE', 11000, 'r.gueye'],
    ['M.', 'Pape', 'Thiam', 'Juriste', 'Droit', 'VACATAIRE', 10000, 'p.thiam'],
  ] as T[]) {
    const mail = `${email}@${DOMAIN}`;
    const u = account ? await user(mail, firstName, lastName, 'ENSEIGNANT') : null;
    const t = await prisma.teacher.create({ data: { employeeNumber: `ENS-${String(++n).padStart(5, '0')}`, title, firstName, lastName, grade, specialtyField, status, hourlyRate, email: mail, userId: u?.id } });
    teachers.set(lastName, t.id);
  }
  await prisma.counter.create({ data: { key: 'teacher', value: n } });
  await prisma.teacher.update({ where: { id: teachers.get('Fall')! }, data: { unavailability: [{ day: 'LUNDI', start: '08:00' }, { day: 'LUNDI', start: '10:00' }] } });
  await prisma.teacher.update({ where: { id: teachers.get('Mensah')! }, data: { unavailability: ['MARDI', 'JEUDI'].flatMap((day) => ['08:00', '10:00', '14:00', '16:00'].map((start) => ({ day, start }))) } });
  log(`${n} enseignants (dont 2 avec compte), disponibilités`);

  // ---- Affectations : couvrent tous les volumes ----
  const A = async (who: string, code: string, type: 'CM' | 'TD' | 'TP', coordinator = false) => {
    const u = ue(code);
    const hours = u[({ CM: 'cmHours', TD: 'tdHours', TP: 'tpHours' } as const)[type]].toNumber();
    if (hours) await assignments.create(admin, { teacherId: teachers.get(who)!, teachingUnitId: u.id, academicYearId: year.id, sessionType: type, assignedHours: hours, completedHours: Math.round(hours * 0.4), isCoordinator: coordinator });
  };
  for (const [who, code, types] of [
    ['Fall', 'INF101', 'CM TD'], ['Sow', 'INF101', 'TP'], ['Ba', 'MAT101', 'CM TD'], ['Mensah', 'ANG101', 'TD'],
    ['Diop', 'GL103', 'CM TP'], ['Sow', 'RT103', 'CM TP'], ['Fall', 'INF102', 'CM TD'], ['Diop', 'INF102', 'TP'],
    ['Ba', 'MAT102', 'CM TD'], ['Mensah', 'COM101', 'TD'], ['Diop', 'GL201', 'CM TD TP'], ['Sow', 'RT201', 'CM TD TP'],
    ['Ndiaye', 'ECO101', 'CM TD'], ['Gueye', 'CPT101', 'CM TD'], ['Ndiaye', 'FIN101', 'CM TD'], ['Gueye', 'MKT101', 'CM TD'], ['Thiam', 'DRT101', 'CM'],
  ] as const) {
    for (const [i, t] of types.split(' ').entries()) await A(who, code, t as 'CM' | 'TD' | 'TP', i === 0);
  }
  log('affectations (toutes les heures sont couvertes, un responsable par UE)');

  // ---- Étudiants (+ un compte étudiant) ----
  const first = { F: ['Awa', 'Fatou', 'Mariama', 'Aminata', 'Khadija', 'Ndeye', 'Bineta', 'Coumba', 'Astou', 'Seynabou', 'Mame', 'Rama'], M: ['Moussa', 'Ousmane', 'Ibrahima', 'Cheikh', 'Mamadou', 'Abdou', 'Lamine', 'Babacar', 'Modou', 'Serigne', 'Alioune', 'Pape'] };
  const last = ['Diallo', 'Ndiaye', 'Sarr', 'Faye', 'Ba', 'Diop', 'Sow', 'Fall', 'Gueye', 'Mbaye', 'Kane', 'Cissé', 'Thiam', 'Seck', 'Wade', 'Niang'];
  const places = ['Dakar', 'Thiès', 'Saint-Louis', 'Kaolack', 'Ziguinchor', 'Mbour', 'Touba', 'Rufisque'];
  let k = 0;
  const mkStudent = async (schoolId: string, levelId: string, specialtyId: string | null, forced?: { firstName: string; lastName: string; gender: 'M' | 'F' }) => {
    const gender = forced?.gender ?? (k % 2 ? 'M' : 'F');
    const firstName = forced?.firstName ?? first[gender][k % 12]!;
    const lastName = forced?.lastName ?? last[(k * 7) % last.length]!;
    k++;
    return students.create(admin, {
      firstName, lastName, gender, birthDate: `200${5 + (k % 3)}-${String(1 + (k % 12)).padStart(2, '0')}-${String(1 + (k % 27)).padStart(2, '0')}`,
      birthPlace: places[k % places.length]!, nationality: 'Sénégalaise', phone: `+221 77 ${String(100 + k).padStart(3, '0')} 00 ${String(k % 100).padStart(2, '0')}`,
      email: forced ? `awa.diallo@${DOMAIN}` : undefined,
      guardianName: `${first.M[(k + 3) % 12]} ${lastName}`, guardianRelation: 'Père', guardianPhone: `+221 76 ${String(200 + k).padStart(3, '0')} 11 11`,
      schoolId, enrollment: { academicYearId: year.id, levelId, specialtyId },
    });
  };
  const awa = await mkStudent(eit.id, l1.id, gl.id, { firstName: 'Awa', lastName: 'Diallo', gender: 'F' });
  for (let i = 0; i < 11; i++) await mkStudent(eit.id, l1.id, gl.id);
  for (let i = 0; i < 12; i++) await mkStudent(eit.id, l1.id, rt.id);
  for (let i = 0; i < 8; i++) await mkStudent(esc.id, b1.id, fin.id);
  for (let i = 0; i < 8; i++) await mkStudent(esc.id, b1.id, mkt.id);
  const awaUser = await user(`awa.diallo@${DOMAIN}`, 'Awa', 'Diallo', 'ETUDIANT');
  await prisma.student.update({ where: { id: awa.id }, data: { userId: awaUser.id } });
  // deux étudiants de plus, pas encore inscrits cette année (alerte du tableau de bord)
  await prisma.student.create({ data: { matricule: 'EIT-2025-00099', firstName: 'Lamine', lastName: 'Kane', gender: 'M', birthDate: new Date('2004-05-05'), birthPlace: 'Dakar', schoolId: eit.id } });
  log(`${k + 1} étudiants (matricules automatiques), inscriptions ${YEAR}, compte étudiant pour Awa Diallo`);

  // ---- Notes : EIT L1 complètes puis délibérées ; ESC B1 partielles ----
  const fill = async (code: string, level: 'good' | 'mixed', partial = 1) => {
    const u = ue(code);
    const sheet = await grades.getSheet(admin, u.id, year.id, 'NORMALE');
    const rows = sheet.rows.slice(0, Math.ceil(sheet.rows.length * partial));
    if (!rows.length) return;
    await grades.saveSheet(admin, u.id, {
      academicYearId: year.id, session: 'NORMALE',
      grades: rows.map((r) => {
        const isAwa = r.student.id === awa.id;
        const mean = isAwa ? 15 : level === 'good' ? 12.5 : 10.5;
        return { enrollmentId: r.enrollmentId, ccScore: note(mean), examScore: rnd() < 0.03 && !isAwa ? null : note(mean - 0.5, 5), tpScore: u.tpWeight ? note(mean + 1) : null, isAbsent: false };
      }).map((g) => ({ ...g, isAbsent: g.examScore === null })),
    });
  };
  for (const u of eitUnits) await fill(u.code, u.code.startsWith('MAT') ? 'mixed' : 'good');
  // Rattrapage pour les UE < 10 de L1
  for (const u of eitUnits) {
    const r = await grades.getSheet(admin, u.id, year.id, 'RATTRAPAGE');
    if (r.rows.length) await grades.saveSheet(admin, u.id, { academicYearId: year.id, session: 'RATTRAPAGE', grades: r.rows.map((x) => ({ enrollmentId: x.enrollmentId, examScore: note(11, 4), isAbsent: false })) });
  }
  const delib = await results.deliberate(admin, l1.id, year.id);
  for (const u of escUnits.filter((x) => x.semester === 1)) await fill(u.code, 'mixed', 0.6);
  log(`notes saisies ; délibération EIT L1 : ${delib.admitted}/${delib.deliberated} admis ; notes ESC B1 en cours`);

  // ---- Syllabus, emplois du temps, certificat ----
  await saveSyllabus(admin, ue('INF101').id, {
    year: YEAR, status: 'PUBLIE', competencies: '- Concevoir un algorithme efficace\n- Analyser sa complexité\n- Choisir une structure de données adaptée',
    teachingMethods: '- Cours magistraux illustrés\n- Travaux dirigés en petits groupes\n- Projet de programmation en binôme',
    evaluationMethods: 'Deux devoirs surveillés et un projet composent le contrôle continu. Examen écrit de 2 h sans document.',
    content: [
      { title: "Introduction à l'algorithmique", sessionType: 'CM', hours: 10, description: 'Pseudo-code, preuve, invariants' },
      { title: 'Structures de données linéaires', sessionType: 'CM', hours: 20, description: 'Tableaux, listes, piles, files' },
      { title: 'Exercices de tri et de recherche', sessionType: 'TD', hours: 18, description: null },
      { title: 'Implémentation en Python', sessionType: 'TP', hours: 12, description: 'Projet en binôme' },
    ],
  });
  const s1 = await schedules.generate(admin, { levelId: l1.id, academicYearId: year.id, semester: 1, weeks: 14 });
  await schedules.setStatus(admin, s1.schedule!.id, 'PUBLIE');
  await schedules.generate(admin, { levelId: l1.id, academicYearId: year.id, semester: 2, weeks: 14 });
  await schedules.generate(admin, { levelId: b1.id, academicYearId: year.id, semester: 1, weeks: 14 });
  const rep = s1.schedule!.report!;
  log(`emplois du temps : EIT L1 S1 publié (${rep.placed}/${rep.total} séances), EIT L1 S2 et ESC B1 S1 en brouillon`);
  const cert = await certificates.issue(admin, awa.id, YEAR, 'Demande de bourse');
  log(`syllabus INF101 publié, certificat ${cert.number}`);

  console.log(`\n✅ Démo prête. Connectez-vous avec l'un des comptes ci-dessous (mot de passe : ${PASSWORD}) :`);
  for (const [r, e] of [['ADMIN', 'admin'], ['SCOLARITE', 'scolarite'], ['ENSEIGNANT', 'o.fall'], ['ETUDIANT', 'awa.diallo']] as const) console.log(`   ${r.padEnd(11)} ${e}@${DOMAIN}`);
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await closePdfBrowser(); await prisma.$disconnect(); });
