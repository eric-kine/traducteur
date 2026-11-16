-- pdfUrl est supprimé : les PDF sont générés à la demande (la table syllabi était vide).
-- AlterTable
ALTER TABLE "syllabi" DROP COLUMN "pdfUrl",
ADD COLUMN     "teachingMethods" TEXT,
ADD COLUMN     "updatedById" TEXT;

-- AddForeignKey
ALTER TABLE "syllabi" ADD CONSTRAINT "syllabi_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
