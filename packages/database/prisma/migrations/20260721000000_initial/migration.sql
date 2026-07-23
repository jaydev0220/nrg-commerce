-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "MfaMethod" AS ENUM ('authenticator', 'passkey');

-- CreateEnum
CREATE TYPE "PasskeyDeviceType" AS ENUM ('singleDevice', 'multiDevice');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('pending', 'confirmed', 'processing', 'completed', 'cancelled', 'refunded');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('debug', 'info', 'warn', 'error', 'fatal');

-- CreateEnum
CREATE TYPE "LogKind" AS ENUM ('audit', 'request');

-- CreateTable
CREATE TABLE "Staff" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "StaffStatus" NOT NULL DEFAULT 'inactive',
    "passwordHash" TEXT,
    "preferredMfaMethod" "MfaMethod",
    "failedAuthCount" INTEGER NOT NULL DEFAULT 0,
    "failedAuthWindowStartedAt" TIMESTAMPTZ(6),
    "authBlockedUntil" TIMESTAMPTZ(6),
    "lastLoginAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRole" (
    "staffId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "assignedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRole_pkey" PRIMARY KEY ("staffId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "authenticatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "jwtId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "previousTokenId" UUID,
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6),
    "consumedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TotpCredential" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "secretEncrypted" TEXT NOT NULL,
    "digits" INTEGER NOT NULL DEFAULT 6,
    "period" INTEGER NOT NULL DEFAULT 30,
    "verifiedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "lastUsedTimeStep" BIGINT,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "TotpCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasskeyCredential" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "credentialId" TEXT NOT NULL,
    "publicKey" BYTEA NOT NULL,
    "userHandle" TEXT,
    "counter" INTEGER NOT NULL DEFAULT 0,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "aaguid" TEXT,
    "deviceType" "PasskeyDeviceType",
    "backedUp" BOOLEAN,
    "nickname" TEXT,
    "verifiedAt" TIMESTAMPTZ(6),
    "lastUsedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductCategory" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "descriptionEn" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "parentId" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "description" TEXT,
    "descriptionEn" TEXT,
    "categoryId" UUID,
    "thumbnailImageId" UUID,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductSku" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "skuCode" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "stockQuantity" INTEGER NOT NULL DEFAULT 0,
    "attributes" JSONB NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductSku_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "skuId" UUID,
    "imageUrl" TEXT NOT NULL,
    "assetKey" TEXT,
    "altText" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "focusX" DOUBLE PRECISION,
    "focusY" DOUBLE PRECISION,
    "zoom" DOUBLE PRECISION,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductImageUpload" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "assetKey" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "consumedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImageUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessLabel" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "discountRate" DECIMAL(5,2),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "BusinessLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "taxId" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "labelId" UUID,
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL,
    "businessId" UUID,
    "status" "OrderStatus" NOT NULL DEFAULT 'pending',
    "version" INTEGER NOT NULL DEFAULT 0,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    "customerAddress" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discountLabelId" UUID,
    "discountLabelName" TEXT,
    "suggestedDiscountRate" DECIMAL(5,2),
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10,2) NOT NULL,
    "completedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "refundedAt" TIMESTAMPTZ(6),
    "idempotencyKey" UUID,
    "idempotencyFingerprint" CHAR(64),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productSkuId" UUID,
    "skuCode" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lineTotal" DECIMAL(10,2) NOT NULL,
    "attributes" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" UUID NOT NULL,
    "level" "LogLevel" NOT NULL,
    "kind" "LogKind" NOT NULL,
    "message" TEXT NOT NULL,
    "actorStaffId" UUID,
    "requestId" TEXT,
    "method" TEXT,
    "path" TEXT,
    "statusCode" INTEGER,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_email_key" ON "Staff"("email");

-- CreateIndex
CREATE INDEX "Staff_status_createdAt_idx" ON "Staff"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Staff_deletedAt_idx" ON "Staff"("deletedAt");

-- CreateIndex
CREATE INDEX "Staff_authBlockedUntil_idx" ON "Staff"("authBlockedUntil");

-- CreateIndex
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

-- CreateIndex
CREATE INDEX "StaffRole_roleId_idx" ON "StaffRole"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE INDEX "AuthSession_staffId_revokedAt_idx" ON "AuthSession"("staffId", "revokedAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_jwtId_key" ON "RefreshToken"("jwtId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_previousTokenId_key" ON "RefreshToken"("previousTokenId");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_revokedAt_idx" ON "RefreshToken"("sessionId", "revokedAt");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "TotpCredential_staffId_deletedAt_idx" ON "TotpCredential"("staffId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyCredential_credentialId_key" ON "PasskeyCredential"("credentialId");

-- CreateIndex
CREATE INDEX "PasskeyCredential_staffId_deletedAt_idx" ON "PasskeyCredential"("staffId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductCategory_slug_key" ON "ProductCategory"("slug");

-- CreateIndex
CREATE INDEX "ProductCategory_parentId_position_idx" ON "ProductCategory"("parentId", "position");

-- CreateIndex
CREATE INDEX "ProductCategory_deletedAt_idx" ON "ProductCategory"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_slug_key" ON "Product"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_thumbnailImageId_key" ON "Product"("thumbnailImageId");

-- CreateIndex
CREATE INDEX "Product_categoryId_published_createdAt_idx" ON "Product"("categoryId", "published", "createdAt");

-- CreateIndex
CREATE INDEX "Product_slug_idx" ON "Product"("slug");

-- CreateIndex
CREATE INDEX "Product_published_createdAt_idx" ON "Product"("published", "createdAt");

-- CreateIndex
CREATE INDEX "Product_deletedAt_idx" ON "Product"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductSku_skuCode_key" ON "ProductSku"("skuCode");

-- CreateIndex
CREATE INDEX "ProductSku_productId_createdAt_idx" ON "ProductSku"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "ProductSku_deletedAt_idx" ON "ProductSku"("deletedAt");

-- CreateIndex
CREATE INDEX "ProductImage_productId_skuId_position_idx" ON "ProductImage"("productId", "skuId", "position");

-- CreateIndex
CREATE INDEX "ProductImage_deletedAt_idx" ON "ProductImage"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImageUpload_assetKey_key" ON "ProductImageUpload"("assetKey");

-- CreateIndex
CREATE INDEX "ProductImageUpload_productId_consumedAt_idx" ON "ProductImageUpload"("productId", "consumedAt");

-- CreateIndex
CREATE INDEX "ProductImageUpload_expiresAt_idx" ON "ProductImageUpload"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessLabel_nameKey_key" ON "BusinessLabel"("nameKey");

-- CreateIndex
CREATE INDEX "BusinessLabel_deletedAt_name_idx" ON "BusinessLabel"("deletedAt", "name");

-- CreateIndex
CREATE INDEX "Business_labelId_idx" ON "Business"("labelId");

-- CreateIndex
CREATE INDEX "Business_deletedAt_idx" ON "Business"("deletedAt");

-- CreateIndex
CREATE INDEX "Business_name_createdAt_idx" ON "Business"("name", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_idempotencyKey_key" ON "Order"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Order_businessId_createdAt_idx" ON "Order"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_createdAt_idx" ON "OrderItem"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_productSkuId_idx" ON "OrderItem"("productSkuId");

-- CreateIndex
CREATE INDEX "Log_level_createdAt_idx" ON "Log"("level", "createdAt");

-- CreateIndex
CREATE INDEX "Log_kind_createdAt_idx" ON "Log"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "Log_actorStaffId_createdAt_idx" ON "Log"("actorStaffId", "createdAt");

-- CreateIndex
CREATE INDEX "Log_requestId_idx" ON "Log"("requestId");

-- CreateIndex
CREATE INDEX "Log_entityType_entityId_idx" ON "Log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "Log_expiresAt_idx" ON "Log"("expiresAt");

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRole" ADD CONSTRAINT "StaffRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_previousTokenId_fkey" FOREIGN KEY ("previousTokenId") REFERENCES "RefreshToken"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TotpCredential" ADD CONSTRAINT "TotpCredential_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasskeyCredential" ADD CONSTRAINT "PasskeyCredential_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductCategory" ADD CONSTRAINT "ProductCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ProductCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_thumbnailImageId_fkey" FOREIGN KEY ("thumbnailImageId") REFERENCES "ProductImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductSku" ADD CONSTRAINT "ProductSku_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_skuId_fkey" FOREIGN KEY ("skuId") REFERENCES "ProductSku"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductImageUpload" ADD CONSTRAINT "ProductImageUpload_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "BusinessLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_discountLabelId_fkey" FOREIGN KEY ("discountLabelId") REFERENCES "BusinessLabel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productSkuId_fkey" FOREIGN KEY ("productSkuId") REFERENCES "ProductSku"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Log" ADD CONSTRAINT "Log_actorStaffId_fkey" FOREIGN KEY ("actorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
-- AddCheckConstraints
ALTER TABLE "Staff"
    ADD CONSTRAINT "Staff_failedAuthCount_check" CHECK ("failedAuthCount" >= 0);

ALTER TABLE "AuthSession"
    ADD CONSTRAINT "AuthSession_expiry_check" CHECK ("expiresAt" > "authenticatedAt");

ALTER TABLE "RefreshToken"
    ADD CONSTRAINT "RefreshToken_expiry_check" CHECK ("expiresAt" > "issuedAt");

ALTER TABLE "TotpCredential"
    ADD CONSTRAINT "TotpCredential_digits_check" CHECK ("digits" BETWEEN 6 AND 8),
    ADD CONSTRAINT "TotpCredential_period_check" CHECK ("period" > 0),
    ADD CONSTRAINT "TotpCredential_timeStep_check" CHECK ("lastUsedTimeStep" IS NULL OR "lastUsedTimeStep" >= 0);

ALTER TABLE "PasskeyCredential"
    ADD CONSTRAINT "PasskeyCredential_counter_check" CHECK ("counter" >= 0);

ALTER TABLE "ProductCategory"
    ADD CONSTRAINT "ProductCategory_position_check" CHECK ("position" >= 0);

ALTER TABLE "ProductSku"
    ADD CONSTRAINT "ProductSku_price_check" CHECK ("price" >= 0),
    ADD CONSTRAINT "ProductSku_stockQuantity_check" CHECK ("stockQuantity" >= 0);

ALTER TABLE "ProductImage"
    ADD CONSTRAINT "ProductImage_position_check" CHECK ("position" >= 0),
    ADD CONSTRAINT "ProductImage_focusX_check" CHECK ("focusX" IS NULL OR "focusX" BETWEEN 0 AND 1),
    ADD CONSTRAINT "ProductImage_focusY_check" CHECK ("focusY" IS NULL OR "focusY" BETWEEN 0 AND 1),
    ADD CONSTRAINT "ProductImage_zoom_check" CHECK ("zoom" IS NULL OR "zoom" BETWEEN 1 AND 3),
    ADD CONSTRAINT "ProductImage_cropTuple_check" CHECK (
        ("focusX" IS NULL AND "focusY" IS NULL AND "zoom" IS NULL)
        OR ("focusX" IS NOT NULL AND "focusY" IS NOT NULL AND "zoom" IS NOT NULL)
    );

ALTER TABLE "ProductImageUpload"
    ADD CONSTRAINT "ProductImageUpload_expiry_check" CHECK ("expiresAt" > "createdAt");

ALTER TABLE "BusinessLabel"
    ADD CONSTRAINT "BusinessLabel_discountRate_check" CHECK (
        "discountRate" IS NULL OR "discountRate" BETWEEN 0 AND 100
    );

ALTER TABLE "Order"
    ADD CONSTRAINT "Order_version_check" CHECK ("version" >= 0),
    ADD CONSTRAINT "Order_itemCount_check" CHECK ("itemCount" >= 0),
    ADD CONSTRAINT "Order_subtotalAmount_check" CHECK ("subtotalAmount" >= 0),
    ADD CONSTRAINT "Order_suggestedDiscountRate_check" CHECK (
        "suggestedDiscountRate" IS NULL OR "suggestedDiscountRate" BETWEEN 0 AND 100
    ),
    ADD CONSTRAINT "Order_discountRate_check" CHECK ("discountRate" BETWEEN 0 AND 100),
    ADD CONSTRAINT "Order_discountAmount_check" CHECK (
        "discountAmount" >= 0 AND "discountAmount" <= "subtotalAmount"
    ),
    ADD CONSTRAINT "Order_totalAmount_check" CHECK (
        "totalAmount" >= 0 AND "totalAmount" = "subtotalAmount" - "discountAmount"
    ),
    ADD CONSTRAINT "Order_idempotency_check" CHECK (
        ("idempotencyKey" IS NULL) = ("idempotencyFingerprint" IS NULL)
    ),
    ADD CONSTRAINT "Order_completedAt_check" CHECK (
        "status" NOT IN ('completed', 'refunded') OR "completedAt" IS NOT NULL
    ),
    ADD CONSTRAINT "Order_cancelledAt_check" CHECK (
        ("status" = 'cancelled') = ("cancelledAt" IS NOT NULL)
    ),
    ADD CONSTRAINT "Order_refundedAt_check" CHECK (
        ("status" = 'refunded') = ("refundedAt" IS NOT NULL)
    );

ALTER TABLE "OrderItem"
    ADD CONSTRAINT "OrderItem_unitPrice_check" CHECK ("unitPrice" >= 0),
    ADD CONSTRAINT "OrderItem_quantity_check" CHECK ("quantity" > 0),
    ADD CONSTRAINT "OrderItem_lineTotal_check" CHECK ("lineTotal" = "unitPrice" * "quantity");

ALTER TABLE "Log"
    ADD CONSTRAINT "Log_statusCode_check" CHECK (
        "statusCode" IS NULL OR "statusCode" BETWEEN 100 AND 599
    ),
    ADD CONSTRAINT "Log_expiry_check" CHECK ("expiresAt" > "createdAt");

-- Enforce one verified, active authenticator credential per staff account.
CREATE UNIQUE INDEX "TotpCredential_one_active_per_staff_idx"
ON "TotpCredential"("staffId")
WHERE "deletedAt" IS NULL AND "verifiedAt" IS NOT NULL;
