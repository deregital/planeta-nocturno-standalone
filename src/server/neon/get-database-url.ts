import 'server-only';

const NEON_API_URL = 'https://console.neon.tech/api/v2';
const DATABASE_ROLE = 'neondb_owner';

type NeonProject = {
  id: string;
  name: string;
};

type NeonBranch = {
  id: string;
  parent_id?: string;
};

let targetPromise: Promise<{ projectId: string; branchId: string }> | undefined;

export async function getTenantDatabaseUrl(databaseName: string) {
  const { projectId, branchId } = await getNeonTarget();
  const params = new URLSearchParams({
    branch_id: branchId,
    database_name: databaseName,
    role_name: DATABASE_ROLE,
    pooled: 'true',
  });
  const connection = await neonRequest<{ uri: string }>(
    `/projects/${projectId}/connection_uri?${params}`,
  );

  return connection.uri;
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

async function neonRequest<T>(path: string): Promise<T> {
  const apiKey = process.env.NEON_API_KEY;
  if (!apiKey) throw new Error('NEON_API_KEY is required');

  const response = await fetch(`${NEON_API_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Neon API request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}
