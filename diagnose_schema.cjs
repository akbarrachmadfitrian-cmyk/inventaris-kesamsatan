const { execSync } = require('child_process');

try {
  const out = execSync(`npx -y wrangler d1 execute inventaris_kesamsatan --remote --command="PRAGMA table_info('device_requests_history')"`, { encoding: 'utf8' });
  console.log(out);
} catch (err) {
  console.error(err.stdout || err.stderr || err.message);
}
