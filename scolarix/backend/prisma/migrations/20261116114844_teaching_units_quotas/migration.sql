-- AlterTable
ALTER TABLE "teaching_units" ADD COLUMN     "bibliography" TEXT,
ADD COLUMN     "hourlyRate" DECIMAL(10,2),
ADD COLUMN     "objectives" TEXT,
ADD COLUMN     "paidHoursAuto" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prerequisites" TEXT;

-- CreateIndex
CREATE INDEX "teaching_units_levelId_semester_idx" ON "teaching_units"("levelId", "semester");

-- Règles de cohérence vérifiées par la base elle-même
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_hours_positive"
  CHECK ("cmHours" >= 0 AND "tdHours" >= 0 AND "tpHours" >= 0 AND "paidHours" >= 0);
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_total_is_sum"
  CHECK ("totalHours" = "cmHours" + "tdHours" + "tpHours");
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_weights_sum_100"
  CHECK ("ccWeight" + "examWeight" + "tpWeight" = 100
         AND "ccWeight" >= 0 AND "examWeight" >= 0 AND "tpWeight" >= 0);
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_semester_range" CHECK ("semester" BETWEEN 1 AND 2);
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_credits_positive" CHECK ("credits" >= 0);
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_coefficient_positive" CHECK ("coefficient" > 0);
ALTER TABLE "teaching_units" ADD CONSTRAINT "teaching_units_rate_positive" CHECK ("hourlyRate" IS NULL OR "hourlyRate" >= 0);
