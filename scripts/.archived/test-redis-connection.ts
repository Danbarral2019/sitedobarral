import { healthCheck } from '../lib/cache/redis-client';

console.log('\n🔍 Testing Redis Connection...\n');

console.log('Environment Variables:');
console.log(`UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '✅ SET' : '❌ NOT SET'}`);
console.log(`UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '✅ SET' : '❌ NOT SET'}`);
console.log('');

healthCheck()
  .then((result) => {
    if (result.connected) {
      console.log('✅ Redis Connected!');
      console.log(`   Latency: ${result.latency}ms`);
    } else {
      console.log('❌ Redis Not Connected');
      console.log(`   Error: ${result.error}`);
    }
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
  });
