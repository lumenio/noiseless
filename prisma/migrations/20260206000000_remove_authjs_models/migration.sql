-- Remove Auth.js models (migrating to Clerk)
DROP TABLE IF EXISTS "VerificationToken";
DROP TABLE IF EXISTS "Session";
DROP TABLE IF EXISTS "Account";
ALTER TABLE "User" DROP COLUMN IF EXISTS "emailVerified";
