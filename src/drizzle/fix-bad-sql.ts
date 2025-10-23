import fs from 'fs';
import path from 'path';

const schemaPath = path.resolve(process.cwd(), './src/drizzle/schema.ts');
let content = fs.readFileSync(schemaPath, 'utf8');

// ⚙️ Busca expresiones de default generadas erróneamente
content = content.replace(
  /default\(upper\(substr\(md5\(\(random\(\)\)::text\), 1, 6\)\)\)/g,
  'default(sql`upper(substr(md5((random())::text), 1, 6))`)',
);

// Guarda los cambios
fs.writeFileSync(schemaPath, content);
