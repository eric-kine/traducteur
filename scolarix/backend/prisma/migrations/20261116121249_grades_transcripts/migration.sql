-- enteredById (lien vers Teacher) est remplacé par enteredByUserId (lien vers User).
-- La table grades était vide à ce stade : aucune donnée perdue.
-- DropForeignKey
ALTER TABLE "grades" DROP CONSTRAINT "grades_enteredById_fkey";

-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "deliberatedAt" TIMESTAMP(3),
ADD COLUMN     "mention" TEXT;

-- AlterTable
ALTER TABLE "generated_documents" ALTER COLUMN "fileUrl" DROP NOT NULL;

-- AlterTable
ALTER TABLE "grades" DROP COLUMN "enteredById",
ADD COLUMN     "enteredByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "grades" ADD CONSTRAINT "grades_enteredByUserId_fkey" FOREIGN KEY ("enteredByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Les notes sont sur 20
ALTER TABLE "grades" ADD CONSTRAINT "grades_scores_range" CHECK (
  ("ccScore" IS NULL OR "ccScore" BETWEEN 0 AND 20) AND
  ("examScore" IS NULL OR "examScore" BETWEEN 0 AND 20) AND
  ("tpScore" IS NULL OR "tpScore" BETWEEN 0 AND 20) AND
  ("finalScore" IS NULL OR "finalScore" BETWEEN 0 AND 20)
);
