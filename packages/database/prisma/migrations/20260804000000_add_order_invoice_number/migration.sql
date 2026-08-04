-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "invoiceNumber" VARCHAR(50);

-- CreateIndex
CREATE UNIQUE INDEX "Order_invoiceNumber_key" ON "Order"("invoiceNumber");
