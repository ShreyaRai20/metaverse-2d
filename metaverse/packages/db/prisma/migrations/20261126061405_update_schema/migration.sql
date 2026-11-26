/*
  Warnings:

  - Made the column `x` on table `MapElements` required. This step will fail if there are existing NULL values in that column.
  - Made the column `y` on table `MapElements` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "User" DROP CONSTRAINT "User_avatarId_fkey";

-- AlterTable
ALTER TABLE "Element" ADD COLUMN     "static" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Map" ADD COLUMN     "thumbnail" TEXT;

-- AlterTable
ALTER TABLE "MapElements" ALTER COLUMN "x" SET NOT NULL,
ALTER COLUMN "y" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "avatarId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_avatarId_fkey" FOREIGN KEY ("avatarId") REFERENCES "Avatar"("id") ON DELETE SET NULL ON UPDATE CASCADE;
