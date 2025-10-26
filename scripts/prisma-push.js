// Load environment from .env.local explicitly
require('dotenv').config({ path: '.env.local' });

const { execSync } = require('child_process');

try {
  console.log('🔄 Pushing Prisma schema changes to database...\n');

  // Run prisma db push with the loaded environment
  execSync('npx prisma db push', {
    stdio: 'inherit',
    env: process.env
  });

  console.log('\n✅ Schema pushed successfully!');

} catch (error) {
  console.error('❌ Error pushing schema:', error.message);
  process.exit(1);
}
