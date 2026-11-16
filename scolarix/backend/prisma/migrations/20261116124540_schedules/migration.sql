-- Remplacement de timetables / timetable_slots (jamais utilisées, vides) par schedules /
-- schedule_sessions + timeslots. teachers.availability (vide) devient unavailability.
-- DropForeignKey
ALTER TABLE "timetable_slots" DROP CONSTRAINT "timetable_slots_roomId_fkey";

-- DropForeignKey
ALTER TABLE "timetable_slots" DROP CONSTRAINT "timetable_slots_teacherId_fkey";

-- DropForeignKey
ALTER TABLE "timetable_slots" DROP CONSTRAINT "timetable_slots_teachingUnitId_fkey";

-- DropForeignKey
ALTER TABLE "timetable_slots" DROP CONSTRAINT "timetable_slots_timetableId_fkey";

-- DropForeignKey
ALTER TABLE "timetables" DROP CONSTRAINT "timetables_academicYearId_fkey";

-- DropForeignKey
ALTER TABLE "timetables" DROP CONSTRAINT "timetables_levelId_fkey";

-- DropForeignKey
ALTER TABLE "timetables" DROP CONSTRAINT "timetables_specialtyId_fkey";

-- AlterTable
ALTER TABLE "rooms" ADD COLUMN     "unavailability" JSONB;

-- AlterTable
ALTER TABLE "teachers" DROP COLUMN "availability",
ADD COLUMN     "unavailability" JSONB;

-- DropTable
DROP TABLE "timetable_slots";

-- DropTable
DROP TABLE "timetables";

-- CreateTable
CREATE TABLE "timeslots" (
    "id" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "instituteId" TEXT NOT NULL,

    CONSTRAINT "timeslots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "id" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'BROUILLON',
    "weeks" INTEGER NOT NULL DEFAULT 14,
    "generationReport" JSONB,
    "generatedAt" TIMESTAMP(3),
    "academicYearId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_sessions" (
    "id" TEXT NOT NULL,
    "day" "Weekday" NOT NULL,
    "sessionType" "SessionType" NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "semester" INTEGER NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "timeslotId" TEXT NOT NULL,
    "teachingUnitId" TEXT NOT NULL,
    "audienceSpecialtyId" TEXT,
    "teacherId" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "timeslots_instituteId_order_key" ON "timeslots"("instituteId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "timeslots_instituteId_startTime_key" ON "timeslots"("instituteId", "startTime");

-- CreateIndex
CREATE UNIQUE INDEX "schedules_academicYearId_levelId_semester_key" ON "schedules"("academicYearId", "levelId", "semester");

-- CreateIndex
CREATE INDEX "schedule_sessions_scheduleId_idx" ON "schedule_sessions"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_sessions_teacherId_academicYearId_semester_day_tim_key" ON "schedule_sessions"("teacherId", "academicYearId", "semester", "day", "timeslotId");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_sessions_roomId_academicYearId_semester_day_timesl_key" ON "schedule_sessions"("roomId", "academicYearId", "semester", "day", "timeslotId");

-- AddForeignKey
ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_instituteId_fkey" FOREIGN KEY ("instituteId") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "academic_years"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_timeslotId_fkey" FOREIGN KEY ("timeslotId") REFERENCES "timeslots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_teachingUnitId_fkey" FOREIGN KEY ("teachingUnitId") REFERENCES "teaching_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_audienceSpecialtyId_fkey" FOREIGN KEY ("audienceSpecialtyId") REFERENCES "specialties"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "teachers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_sessions" ADD CONSTRAINT "schedule_sessions_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Cohérence des créneaux et des salles
ALTER TABLE "timeslots" ADD CONSTRAINT "timeslots_time_format" CHECK ("startTime" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "endTime" ~ '^[0-2][0-9]:[0-5][0-9]$' AND "startTime" < "endTime");
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_capacity_positive" CHECK ("capacity" > 0);
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_semester_range" CHECK ("semester" BETWEEN 1 AND 2 AND "weeks" BETWEEN 1 AND 30);
