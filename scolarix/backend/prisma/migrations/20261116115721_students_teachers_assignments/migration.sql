-- La colonne photoUrl est renommée (et non supprimée) : aucune donnée perdue.
-- AlterTable
ALTER TABLE "students" RENAME COLUMN "photoUrl" TO "photoPath";
ALTER TABLE "students"
ADD COLUMN     "guardianEmail" TEXT,
ADD COLUMN     "guardianRelation" TEXT;

-- AlterTable
ALTER TABLE "teaching_assignments" ADD COLUMN     "completedHours" DECIMAL(6,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "teaching_assignments_teacherId_academicYearId_idx" ON "teaching_assignments"("teacherId", "academicYearId");

-- Cohérence des heures d'affectation
ALTER TABLE "teaching_assignments" ADD CONSTRAINT "teaching_assignments_hours_positive"
  CHECK ("assignedHours" > 0 AND "completedHours" >= 0);
ALTER TABLE "teachers" ADD CONSTRAINT "teachers_rate_positive" CHECK ("hourlyRate" IS NULL OR "hourlyRate" >= 0);
