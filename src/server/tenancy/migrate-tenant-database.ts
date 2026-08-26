import 'server-only';

import { spawn } from 'node:child_process';
import path from 'node:path';

const PRISMA_SCHEMA = path.join(process.cwd(), 'prisma', 'schema.prisma');
const PRISMA_CLI = path.join(
  process.cwd(),
  'node_modules',
  'prisma',
  'build',
  'index.js',
);

export class TenantMigrationError extends Error {
  constructor(cause: unknown) {
    super('Unable to migrate the tenant database', { cause });
    this.name = 'TenantMigrationError';
  }
}

export async function migrateTenantDatabase(connectionString: string) {
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [PRISMA_CLI, 'migrate', 'deploy', '--schema', PRISMA_SCHEMA],
        {
          env: { ...process.env, DATABASE_URL: connectionString },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let output = '';

      child.stdout.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.stderr.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) resolve();
        else
          reject(new Error(output.trim() || `Prisma exited with code ${code}`));
      });
    });
  } catch (error) {
    throw new TenantMigrationError(error);
  }
}
