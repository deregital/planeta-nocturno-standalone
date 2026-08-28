function importMatches(source, suffix) {
  return source === `@/${suffix}` || source.endsWith(`/${suffix}`);
}

function unwrapExpression(node) {
  let current = node;
  while (
    current?.type === 'AwaitExpression' ||
    current?.type === 'ChainExpression' ||
    current?.type === 'TSAsExpression' ||
    current?.type === 'TSNonNullExpression' ||
    current?.type === 'TSTypeAssertion'
  ) {
    current =
      current.type === 'AwaitExpression'
        ? current.argument
        : current.expression;
  }
  return current;
}

function getMemberName(node) {
  if (node.property.type === 'Identifier' && !node.computed) {
    return node.property.name;
  }
  if (node.property.type === 'Literal' && node.computed) {
    return node.property.value;
  }
  return undefined;
}

function expressionContains(node, matches) {
  if (!node) return false;
  if (matches(node)) return true;

  if (node.type === 'CallExpression' || node.type === 'NewExpression') {
    return (
      expressionContains(node.callee, matches) ||
      node.arguments.some((argument) => expressionContains(argument, matches))
    );
  }
  if (node.type === 'MemberExpression') {
    return (
      expressionContains(node.object, matches) ||
      (node.computed && expressionContains(node.property, matches))
    );
  }
  if (node.type === 'ObjectExpression') {
    return node.properties.some((property) =>
      expressionContains(
        property.type === 'SpreadElement' ? property.argument : property.value,
        matches,
      ),
    );
  }
  if (node.type === 'ArrayExpression') {
    return node.elements.some((element) =>
      expressionContains(element, matches),
    );
  }
  if (
    node.type === 'AwaitExpression' ||
    node.type === 'ChainExpression' ||
    node.type === 'SpreadElement' ||
    node.type === 'TSAsExpression' ||
    node.type === 'TSNonNullExpression' ||
    node.type === 'TSTypeAssertion'
  ) {
    return expressionContains(node.expression ?? node.argument, matches);
  }
  return false;
}

function containsIdentifier(node, names) {
  return expressionContains(
    node,
    (candidate) => candidate.type === 'Identifier' && names.has(candidate.name),
  );
}

function isTenantContextDb(node, state) {
  if (node.type !== 'MemberExpression' || getMemberName(node) !== 'db') {
    return false;
  }

  const object = unwrapExpression(node.object);
  return (
    (object.type === 'Identifier' &&
      (object.name === 'ctx' || state.tenantContexts.has(object.name))) ||
    containsIdentifier(object, state.tenantContextFactories)
  );
}

function containsTenantDb(node, state) {
  return expressionContains(node, (candidate) => {
    if (isTenantContextDb(candidate, state)) return true;
    return (
      candidate.type === 'Identifier' &&
      (state.tenantDbs.has(candidate.name) ||
        state.tenantFactories.has(candidate.name))
    );
  });
}

function referencesSchema(node, identifiers, namespaces) {
  return expressionContains(node, (candidate) => {
    if (candidate.type === 'Identifier') {
      return identifiers.has(candidate.name);
    }
    return (
      candidate.type === 'MemberExpression' &&
      candidate.object.type === 'Identifier' &&
      namespaces.has(candidate.object.name)
    );
  });
}

function registerImports(node, state) {
  const source = node.source.value;
  if (typeof source !== 'string') return;

  const isControlClient = importMatches(source, 'db/control/client');
  const isControlSchema = importMatches(source, 'db/control/schema');
  const isTenantClient =
    importMatches(source, 'server/instance/get-instance-db') ||
    importMatches(source, 'drizzle');
  const isTenantContext = importMatches(
    source,
    'server/instance/resolve-request-context',
  );
  const isTenantSchema = importMatches(source, 'drizzle/schema');

  for (const specifier of node.specifiers) {
    if (specifier.type === 'ImportNamespaceSpecifier') {
      if (isControlSchema) state.controlNamespaces.add(specifier.local.name);
      if (isTenantSchema) state.tenantNamespaces.add(specifier.local.name);
      continue;
    }
    if (specifier.type !== 'ImportSpecifier') continue;

    const importedName = specifier.imported.name ?? specifier.imported.value;
    if (isControlClient && importedName === 'getControlDb') {
      state.controlFactories.add(specifier.local.name);
    }
    if (
      isTenantClient &&
      (importedName === 'getInstanceDb' || importedName === 'createDb')
    ) {
      state.tenantFactories.add(specifier.local.name);
    }
    if (
      isTenantContext &&
      (importedName === 'getCurrentRequestContext' ||
        importedName === 'resolveRequestContext')
    ) {
      state.tenantContextFactories.add(specifier.local.name);
    }
    if (isControlSchema) state.controlTables.add(specifier.local.name);
    if (isTenantSchema) state.tenantTables.add(specifier.local.name);
  }
}

function registerDatabaseVariable(node, state) {
  if (!node.init) return;
  const init = unwrapExpression(node.init);

  if (node.id.type === 'ObjectPattern') {
    if (!containsIdentifier(init, state.tenantContextFactories)) return;
    for (const property of node.id.properties) {
      if (
        property.type === 'Property' &&
        property.key.type === 'Identifier' &&
        property.key.name === 'db' &&
        property.value.type === 'Identifier'
      ) {
        state.tenantDbs.add(property.value.name);
      }
    }
    return;
  }

  if (node.id.type !== 'Identifier') return;

  if (
    containsIdentifier(init, state.controlFactories) ||
    containsIdentifier(init, state.controlDbs)
  ) {
    state.controlDbs.add(node.id.name);
    return;
  }
  if (containsIdentifier(init, state.tenantContextFactories)) {
    state.tenantContexts.add(node.id.name);
    return;
  }
  if (containsTenantDb(init, state)) {
    state.tenantDbs.add(node.id.name);
  }
}

export const tenantDbIsolationRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Impide consultar tablas de tenant con Control DB y tablas centrales con una DB de tenant.',
    },
    messages: {
      centralWithTenant:
        'Aislamiento multi-tenant: Control DB no puede consultar tablas de @/drizzle/schema.',
      tenantWithCentral:
        'Aislamiento multi-tenant: una DB de tenant no puede consultar tablas de @/db/control/schema.',
    },
    schema: [],
  },

  create(context) {
    const state = {
      controlDbs: new Set(),
      controlFactories: new Set(),
      controlNamespaces: new Set(),
      controlTables: new Set(),
      tenantContextFactories: new Set(),
      tenantContexts: new Set(),
      tenantDbs: new Set(),
      tenantFactories: new Set(),
      tenantNamespaces: new Set(),
      tenantTables: new Set(),
    };

    return {
      ImportDeclaration(node) {
        registerImports(node, state);
      },

      VariableDeclarator(node) {
        registerDatabaseVariable(node, state);
      },

      CallExpression(node) {
        if (node.callee.type !== 'MemberExpression') return;

        const queryRoot = node.callee.object;
        if (
          (containsIdentifier(queryRoot, state.controlDbs) ||
            containsIdentifier(queryRoot, state.controlFactories)) &&
          node.arguments.some((argument) =>
            referencesSchema(
              argument.type === 'SpreadElement' ? argument.argument : argument,
              state.tenantTables,
              state.tenantNamespaces,
            ),
          )
        ) {
          context.report({ node, messageId: 'centralWithTenant' });
        }

        if (
          containsTenantDb(queryRoot, state) &&
          node.arguments.some((argument) =>
            referencesSchema(
              argument.type === 'SpreadElement' ? argument.argument : argument,
              state.controlTables,
              state.controlNamespaces,
            ),
          )
        ) {
          context.report({ node, messageId: 'tenantWithCentral' });
        }
      },
    };
  },
};

export default tenantDbIsolationRule;
