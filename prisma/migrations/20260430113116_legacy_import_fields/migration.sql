/*
  Warnings:

  - A unique constraint covering the columns `[legacyId]` on the table `LeaveRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[legacyId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "LeaveCategory" ADD VALUE 'FAMILY_CARE';

-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "legacyId" INTEGER,
ADD COLUMN     "receiptUrl" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "legacyId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "LeaveRequest_legacyId_key" ON "LeaveRequest"("legacyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_legacyId_key" ON "User"("legacyId");
