import { RuleTester } from 'eslint';

import tenantDbIsolationRule from '../../eslint/rules/tenant-db-isolation.mjs';

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
});

ruleTester.run(
  'tenant-isolation/no-cross-database-query',
  tenantDbIsolationRule,
  {
    valid: [
      {
        name: 'Control DB consulta únicamente el schema central',
        code: `
          import { getControlDb } from '@/db/control/client';
          import { tenants } from '@/db/control/schema';
          const controlDb = getControlDb();
          controlDb.select().from(tenants);
        `,
      },
      {
        name: 'ctx.db consulta únicamente el schema del tenant',
        code: `
          import { event } from '@/drizzle/schema';
          ctx.db.select().from(event);
        `,
      },
      {
        name: 'una DB obtenida del request context usa el schema del tenant',
        code: `
          import { getCurrentRequestContext } from '@/server/instance/resolve-request-context';
          import { user } from '@/drizzle/schema';
          const { db } = await getCurrentRequestContext();
          db.select().from(user);
        `,
      },
    ],
    invalid: [
      {
        name: 'rechaza una tabla tenant consultada mediante Control DB',
        code: `
          import { getControlDb as connectControl } from '@/db/control/client';
          import { event as tenantEvent } from '@/drizzle/schema';
          const db = connectControl();
          db.select().from(tenantEvent);
        `,
        errors: [{ messageId: 'centralWithTenant' }],
      },
      {
        name: 'rechaza una tabla central consultada mediante ctx.db',
        code: `
          import * as controlSchema from '@/db/control/schema';
          ctx.db.delete(controlSchema.tenants);
        `,
        errors: [{ messageId: 'tenantWithCentral' }],
      },
      {
        name: 'rechaza una tabla central con una DB obtenida del request context',
        code: `
          import { resolveRequestContext } from '@/server/instance/resolve-request-context';
          import { tenants } from '@/db/control/schema';
          const requestContext = await resolveRequestContext(headers);
          const tenantDb = requestContext.db;
          tenantDb.update(tenants);
        `,
        errors: [{ messageId: 'tenantWithCentral' }],
      },
      {
        name: 'rechaza columnas tenant dentro de una proyección central',
        code: `
          import { getControlDb } from '@/db/control/client';
          import { tenants } from '@/db/control/schema';
          import { event } from '@/drizzle/schema';
          getControlDb().select({ tenantId: tenants.id, eventName: event.name });
        `,
        errors: [{ messageId: 'centralWithTenant' }],
      },
    ],
  },
);
