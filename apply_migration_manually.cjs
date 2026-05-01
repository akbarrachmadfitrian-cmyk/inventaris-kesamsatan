const { execSync } = require('child_process');

function run(cmd) {
  console.log(`Executing: ${cmd}`);
  try {
    const out = execSync(cmd, { encoding: 'utf8', stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error('Command failed');
    return false;
  }
}

// Try applying migration
run(`npx -y wrangler d1 execute inventaris_kesamsatan --remote --command="ALTER TABLE device_requests_history ADD COLUMN outcome TEXT;"`);
run(`npx -y wrangler d1 execute inventaris_kesamsatan --remote --command="ALTER TABLE device_requests_history ADD COLUMN rejection_reason TEXT;"`);
