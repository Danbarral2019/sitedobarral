const vars = ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'];
for (const v of vars) {
  const val = process.env[v];
  if (!val) {
    console.log(v.padEnd(42) + 'FALTA');
    continue;
  }
  const masked = val.slice(0, 8) + '...' + val.slice(-4);
  const mode = val.includes('_test_') ? 'test' : val.includes('_live_') ? 'live' : val.startsWith('whsec_') ? 'webhook' : '?';
  console.log(v.padEnd(42) + 'OK   ' + masked.padEnd(24) + ' [' + mode + ']');
}
