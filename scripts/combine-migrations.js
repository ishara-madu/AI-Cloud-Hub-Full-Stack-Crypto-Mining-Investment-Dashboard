import fs from 'fs';
import path from 'path';

const migrationsDir = './supabase/migrations';
const outputFile = './supabase/combined_migrations.sql';

try {
  if (!fs.existsSync(migrationsDir)) {
    console.error(`Error: Migrations directory not found at ${migrationsDir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Chronological sort by filename prefix (e.g. YYYYMMDD...)

  if (files.length === 0) {
    console.log('No SQL migration files found.');
    process.exit(0);
  }

  let combinedContent = `-- =========================================================================\n`;
  combinedContent += `-- CONSOLIDATED SUPABASE MIGRATIONS\n`;
  combinedContent += `-- Generated on ${new Date().toISOString()}\n`;
  combinedContent += `-- Total files: ${files.length}\n`;
  combinedContent += `-- =========================================================================\n\n`;

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    combinedContent += `-- ========================================== \n`;
    combinedContent += `-- START MIGRATION: ${file}\n`;
    combinedContent += `-- ========================================== \n\n`;
    combinedContent += content;
    combinedContent += `\n\n`;
  }

  fs.writeFileSync(outputFile, combinedContent, 'utf-8');
  console.log(`\n🎉 Success! Combined ${files.length} migration files into:`);
  console.log(`   ${path.resolve(outputFile)}\n`);
} catch (error) {
  console.error('Error combining migrations:', error);
  process.exit(1);
}
