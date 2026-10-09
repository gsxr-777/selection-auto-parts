-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "catalog_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceVersion" TEXT,
    "licenseNotes" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "catalog_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "locales" JSONB NOT NULL,
    "extractedAt" TIMESTAMPTZ(3) NOT NULL,
    "importedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "counts" JSONB NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_makes" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "vehicle_makes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_models" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "makeId" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "productionFrom" DATE,
    "productionTo" DATE,
    "partial" BOOLEAN NOT NULL DEFAULT false,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_variants" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "productionFrom" DATE,
    "productionTo" DATE,
    "fuel" TEXT,
    "body" TEXT,
    "transmission" TEXT,
    "powerKw" INTEGER,
    "displacementCm3" INTEGER,
    "engineCode" TEXT,
    "attributes" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "vehicle_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_categories" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "parentId" TEXT,
    "labels" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "part_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_brands" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "part_brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "brandId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "labels" JSONB NOT NULL,
    "attributes" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_fitments" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "attributes" JSONB NOT NULL,

    CONSTRAINT "part_fitments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oe_references" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "normalizedNumber" TEXT NOT NULL,
    "additive" BOOLEAN NOT NULL,
    "information" TEXT NOT NULL,

    CONSTRAINT "oe_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "part_crosses" (
    "id" TEXT NOT NULL,
    "partId" TEXT NOT NULL,
    "targetNumber" TEXT NOT NULL,
    "targetBrand" TEXT NOT NULL,
    "targetSourceId" TEXT,
    "relationType" TEXT NOT NULL,

    CONSTRAINT "part_crosses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_makes_sourceId_key" ON "vehicle_makes"("sourceId");

-- CreateIndex
CREATE INDEX "vehicle_models_makeId_kind_idx" ON "vehicle_models"("makeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_models_kind_sourceId_key" ON "vehicle_models"("kind", "sourceId");

-- CreateIndex
CREATE INDEX "vehicle_variants_modelId_fuel_body_transmission_idx" ON "vehicle_variants"("modelId", "fuel", "body", "transmission");

-- CreateIndex
CREATE INDEX "part_categories_parentId_idx" ON "part_categories"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "part_brands_sourceId_key" ON "part_brands"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sourceId_key" ON "parts"("sourceId");

-- CreateIndex
CREATE INDEX "parts_normalizedNumber_idx" ON "parts"("normalizedNumber");

-- CreateIndex
CREATE UNIQUE INDEX "parts_brandId_number_key" ON "parts"("brandId", "number");

-- CreateIndex
CREATE INDEX "part_fitments_variantId_categoryId_partId_idx" ON "part_fitments"("variantId", "categoryId", "partId");

-- CreateIndex
CREATE INDEX "oe_references_normalizedNumber_idx" ON "oe_references"("normalizedNumber");

-- CreateIndex
CREATE INDEX "oe_references_partId_idx" ON "oe_references"("partId");

-- CreateIndex
CREATE INDEX "part_crosses_partId_idx" ON "part_crosses"("partId");

-- AddForeignKey
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "catalog_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_makes" ADD CONSTRAINT "vehicle_makes_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_makeId_fkey" FOREIGN KEY ("makeId") REFERENCES "vehicle_makes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_models" ADD CONSTRAINT "vehicle_models_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_variants" ADD CONSTRAINT "vehicle_variants_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "vehicle_models"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_variants" ADD CONSTRAINT "vehicle_variants_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "part_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_categories" ADD CONSTRAINT "part_categories_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_brands" ADD CONSTRAINT "part_brands_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "part_brands"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parts" ADD CONSTRAINT "parts_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "vehicle_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_fitments" ADD CONSTRAINT "part_fitments_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "part_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oe_references" ADD CONSTRAINT "oe_references_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "part_crosses" ADD CONSTRAINT "part_crosses_partId_fkey" FOREIGN KEY ("partId") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
