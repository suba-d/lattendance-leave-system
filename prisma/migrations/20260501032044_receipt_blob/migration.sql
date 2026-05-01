-- AlterTable
ALTER TABLE "LeaveRequest" ADD COLUMN     "receiptData" BYTEA,
ADD COLUMN     "receiptMimeType" TEXT;
