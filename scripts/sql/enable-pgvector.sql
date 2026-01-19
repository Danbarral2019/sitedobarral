-- ===========================
-- Enable pgvector extension for Neon PostgreSQL
-- ===========================
-- Run this SQL in Neon Console before running migrations
-- https://console.neon.tech/

-- Enable the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Note: After enabling pgvector, run Prisma migrations:
-- npx prisma db push
-- or
-- npx prisma migrate dev
