require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initDb, db } = require('../config/db');

async function seedJurisdictions() {
  console.log('====================================================');
  console.log(' SEEDING JURISDICTIONS & TEMPORAL BOUNDARIES');
  console.log('====================================================');

  await initDb();

  const fixturePath = path.join(__dirname, '../data/fixtures/mysuru_jurisdictions.geojson');
  if (!fs.existsSync(fixturePath)) {
    console.error(`Fixture not found at ${fixturePath}`);
    process.exit(1);
  }

  const geojson = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  console.log(`Loaded GeoJSON fixture containing ${geojson.features.length} boundary features.`);

  let imported = 0;

  for (const feature of geojson.features) {
    const { code, name, type, version, valid_from, valid_until, description } = feature.properties;
    const geometry = feature.geometry;

    // Validate coordinates
    if (!geometry || geometry.type !== 'Polygon' || !Array.isArray(geometry.coordinates)) {
      console.warn(`[Skip] Invalid polygon geometry for ${code} (${version})`);
      continue;
    }

    // Validate temporal range
    const validFromDate = new Date(valid_from);
    if (isNaN(validFromDate.getTime())) {
      console.warn(`[Skip] Invalid valid_from date for ${code}: ${valid_from}`);
      continue;
    }

    if (valid_until) {
      const validUntilDate = new Date(valid_until);
      if (isNaN(validUntilDate.getTime()) || validUntilDate <= validFromDate) {
        console.warn(`[Skip] Invalid valid_until date for ${code}: ${valid_until}`);
        continue;
      }
    }

    await db.insertJurisdictionBoundary({
      code,
      name,
      type,
      version,
      validFrom: valid_from,
      validUntil: valid_until,
      geometry,
      metadata: { description },
    });

    console.log(`✅ Imported boundary: ${name} [${code}] — Version: ${version} (Valid: ${valid_from} to ${valid_until || 'PRESENT'})`);
    imported++;
  }

  console.log('====================================================');
  console.log(`Successfully seeded ${imported} jurisdiction boundaries.`);
  console.log('====================================================');
}

seedJurisdictions().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
