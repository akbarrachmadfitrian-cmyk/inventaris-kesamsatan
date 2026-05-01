const { execSync } = require('child_process');

function run(cmd) {
  console.log(`\n\n> ${cmd}`);
  try {
    execSync(`npx -y wrangler d1 execute inventaris_kesamsatan --remote --command="${cmd.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
  } catch (e) {
    console.log(`FAILED`);
  }
}

console.log('--- REVISITING DATABASE STATE ---');
run("SELECT name FROM sqlite_master WHERE type='table'");
run("PRAGMA table_info('device_requests')");
run("PRAGMA table_info('device_requests_history')");
run("SELECT id, name FROM samsat LIMIT 20");
run("SELECT count(*) as total FROM device_requests_history");
