require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, db } = require('../config/db');

async function seedResponsibilityRules() {
  console.log('====================================================');
  console.log(' SEEDING RESPONSIBILITY RULES (PHASE 5 SYNTHETIC)');
  console.log('====================================================');

  await initDb();

  const fixturePath = path.join(__dirname, '../data/fixtures/mysuru_responsibility_rules.json');
  if (!fs.existsSync(fixturePath)) {
    throw new Error(`Fixture file not found: ${fixturePath}`);
  }

  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  console.log(`Loaded ${fixture.authorities.length} authorities, ${fixture.departments.length} departments, ${fixture.rules.length} rules.`);

  // 1. Seed Authorities
  console.log('\n--- 1. Seeding Authorities ---');
  for (const auth of fixture.authorities) {
    const saved = await db.insertAuthority(auth);
    console.log(`  ✓ Authority: ${saved.code} (${saved.name}) [${saved.type}]`);
  }

  // 2. Seed Departments
  console.log('\n--- 2. Seeding Departments ---');
  for (const dept of fixture.departments) {
    const saved = await db.insertDepartment(dept);
    console.log(`  ✓ Department: ${saved.code} -> Authority ${dept.authorityCode}`);
  }

  // 3. Seed Responsibility Rules
  console.log('\n--- 3. Seeding Responsibility Rules ---');
  let ruleCount = 0;
  for (const rule of fixture.rules) {
    const saved = await db.insertResponsibilityRule(rule);
    ruleCount++;
    console.log(`  ✓ Rule ${ruleCount}: ${rule.jurisdictionCode} + ${rule.issueCategory} -> ${rule.authorityCode}/${rule.departmentCode} (${rule.version})`);
  }

  console.log('====================================================');
  console.log(` SUCCESSFULLY SEEDED: ${fixture.authorities.length} Authorities, ${fixture.departments.length} Departments, ${fixture.rules.length} Rules.`);
  console.log('====================================================');
}

if (require.main === module) {
  seedResponsibilityRules()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Error] Seeding failed:', err);
      process.exit(1);
    });
}

module.exports = { seedResponsibilityRules };
