require('dotenv').config();
const { initDb, db } = require('../config/db');

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const targetRole = args[1] ? args[1].toUpperCase() : null;

  if (!email || !targetRole) {
    console.log('Usage: node src/scripts/promote.js <email> <CITIZEN|STAFF|ADMIN>');
    console.log('Example: node src/scripts/promote.js citizen@mysuru.civicflow.in STAFF');
    process.exit(1);
  }

  const validRoles = ['CITIZEN', 'STAFF', 'ADMIN'];
  if (!validRoles.includes(targetRole)) {
    console.error(`Invalid role: '${targetRole}'. Allowed roles: ${validRoles.join(', ')}`);
    process.exit(1);
  }

  await initDb();

  try {
    const user = await db.getUserByEmail(email);
    if (!user) {
      console.error(`[Promote Error] No user found with email: ${email}`);
      process.exit(1);
    }

    const previousRole = user.role;
    const updated = await db.updateUserRole(email, targetRole);

    console.log('====================================================');
    console.log(`[Role Promotion Success]`);
    console.log(`User: ${updated.name} (${updated.email})`);
    console.log(`Auth UID: ${updated.auth_uid || updated.authUid}`);
    console.log(`Previous Role: ${previousRole}`);
    console.log(`New Role:      ${updated.role}`);
    console.log('====================================================');
  } catch (err) {
    console.error('[Promote Error]', err.message);
    process.exit(1);
  }
}

main();
