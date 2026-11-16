-- AlterTable
ALTER TABLE "institutes" ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT;

-- AlterTable
ALTER TABLE "schools" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "specialties" ADD COLUMN     "diplomaTitle" TEXT;

-- Règles d'intégrité vérifiées par la base elle-même (en plus de Zod)
ALTER TABLE "levels" ADD CONSTRAINT "levels_order_positive" CHECK ("order" > 0);
ALTER TABLE "levels" ADD CONSTRAINT "levels_required_credits_positive" CHECK ("requiredCredits" >= 0);
ALTER TABLE "schools" ADD CONSTRAINT "schools_code_not_blank" CHECK (length(trim("code")) > 0);
ALTER TABLE "specialties" ADD CONSTRAINT "specialties_code_not_blank" CHECK (length(trim("code")) > 0);
ALTER TABLE "levels" ADD CONSTRAINT "levels_code_not_blank" CHECK (length(trim("code")) > 0);
