ALTER TABLE "oe_references" ADD COLUMN "informationLabels" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "oe_references" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
