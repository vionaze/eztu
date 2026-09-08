ALTER TABLE "ProductVariant" ADD COLUMN "replacementForId" TEXT;
CREATE INDEX "ProductVariant_replacementForId_idx" ON "ProductVariant"("replacementForId");
