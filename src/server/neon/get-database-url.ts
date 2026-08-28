import 'server-only';

import { createHash } from 'node:crypto';

const NEON_API_URL = 'https://console.neon.tech/api/v2';
const DATABASE_ROLE = 'neondb_owner';

type NeonProject = {
  id: string;
  name: string;
};

type NeonBranch = {
  id: string;
  parent_id?: string | null;
};

type NeonOperation = {
  id: string;
  status: string;
  error?: string;
};

let targetPromise: Promise<{ projectId: string; branchId: string }> | undefined;

export class NeonApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'NeonApiError';
  }
}

export async function getTenantDatabaseUrl(databaseName: string) {
  const { projectId, branchId } = await getNeonTarget();
  const params = new URLSearchParams({
    branch_id: branchId,
    database_name: databaseName,
    role_name: DATABASE_ROLE,
    pooled: 'true',
  });
  const connection = await neonRequest<{ uri: string }>(
    `/projects/${projectId}/connection_uri?${params.toString()}`,
  );

  return connection.uri;
}

export function buildTenantDatabaseName(tenantId: number, slug: string) {
  const base = `tenant_${tenantId}_${slug.replaceAll('-', '_')}`;
  if (base.length <= 63) return base;

  const hash = createHash('sha256').update(base).digest('hex').slice(0, 8);
  return `${base.slice(0, 54)}_${hash}`;
}

export function buildDeletedTenantDatabaseName(databaseName: string) {
  const suffix = '_deleted';
  if (databaseName.endsWith(suffix)) return databaseName;
  return `${databaseName.slice(0, 63 - suffix.length)}${suffix}`;
}

export async function createTenantDatabase(databaseName: string) {
  const { projectId, branchId } = await getNeonTarget();
  const result = await neonRequest<{ operations?: NeonOperation[] }>(
    `/projects/${projectId}/branches/${branchId}/databases`,
    {
      method: 'POST',
      body: JSON.stringify({
        database: {
          name: databaseName,
          owner_name: DATABASE_ROLE,
        },
      }),
    },
  );

  await Promise.all(
    (result.operations ?? []).map((operation) =>
      waitForOperation(projectId, operation.id),
    ),
  );
}

export async function deleteTenantDatabase(databaseName: string) {
  const { projectId, branchId } = await getNeonTarget();
  await neonRequest(
    `/projects/${projectId}/branches/${branchId}/databases/${encodeURIComponent(databaseName)}`,
    { method: 'DELETE' },
  );
}

export async function renameTenantDatabase(
  databaseName: string,
  newDatabaseName: string,
) {
  if (databaseName === newDatabaseName) return;

  const { projectId, branchId } = await getNeonTarget();

  try {
    const result = await neonRequest<{ operations?: NeonOperation[] }>(
      `/projects/${projectId}/branches/${branchId}/databases/${encodeURIComponent(databaseName)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ database: { name: newDatabaseName } }),
      },
    );

    await Promise.all(
      (result.operations ?? []).map((operation) =>
        waitForOperation(projectId, operation.id),
      ),
    );
  } catch (error) {
    if (
      error instanceof NeonApiError &&
      error.status === 404 &&
      (await tenantDatabaseExists(projectId, branchId, newDatabaseName))
    ) {
      return;
    }

    throw error;
  }
}

async function tenantDatabaseExists(
  projectId: string,
  branchId: string,
  databaseName: string,
) {
  try {
    await neonRequest(
      `/projects/${projectId}/branches/${branchId}/databases/${encodeURIComponent(databaseName)}`,
    );
    return true;
  } catch (error) {
    if (error instanceof NeonApiError && error.status === 404) return false;
    throw error;
  }
}

function getNeonTarget() {
  targetPromise ??= resolveNeonTarget().catch((error) => {
    targetPromise = undefined;
    throw error;
  });

  return targetPromise;
}

async function resolveNeonTarget() {
  const projectName = process.env.NEON_PROJECT_NAME;
  if (!projectName) throw new Error('NEON_PROJECT_NAME is required');

  const { projects } = await neonRequest<{ projects: NeonProject[] }>(
    '/projects?limit=100',
  );
  const project = projects.find((candidate) => candidate.name === projectName);
  if (!project) throw new Error(`Neon project not found: ${projectName}`);

  const { branches } = await neonRequest<{ branches: NeonBranch[] }>(
    `/projects/${project.id}/branches?limit=100`,
  );
  const rootBranch = branches.find((branch) => !branch.parent_id);
  if (!rootBranch) throw new Error('Neon root branch not found');

  return { projectId: project.id, branchId: rootBranch.id };
}

async function waitForOperation(projectId: string, operationId: string) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    const { operation } = await neonRequest<{ operation: NeonOperation }>(
      `/projects/${projectId}/operations/${operationId}`,
    );

    if (operation.status === 'finished') return;
    if (['failed', 'cancelled', 'skipped'].includes(operation.status)) {
      throw new NeonApiError(
        `Neon operation ${operation.id} ended with status ${operation.status}` +
          (operation.error ? `: ${operation.error}` : ''),
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new NeonApiError(`Neon operation timed out: ${operationId}`);
}

async function neonRequest<T = unknown>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) throw new NeonApiError('NEON_API_KEY is required');

  const response = await fetch(`${NEON_API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new NeonApiError(
      `Neon API request failed (${response.status})`,
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
