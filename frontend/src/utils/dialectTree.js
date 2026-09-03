function sortDialects(items) {
  return items.sort((left, right) => (
    (left.sort_order || 0) - (right.sort_order || 0) || left.id - right.id
  ));
}

export function buildDialectTree(dialects = []) {
  const nodesByCode = new Map(dialects.map((dialect) => [
    dialect.qualified_code,
    { ...dialect, children: [] },
  ]));
  const roots = [];

  nodesByCode.forEach((node) => {
    const segments = node.qualified_code.split('.');
    const parentCode = segments.slice(0, -1).join('.');
    const parent = nodesByCode.get(parentCode);
    if (parent) parent.children.push(node);
    else roots.push(node);
  });

  nodesByCode.forEach((node) => sortDialects(node.children));
  return sortDialects(roots);
}

export function findDialectPath(nodes, dialectId, path = []) {
  let matchedPath = [];
  nodes.some((node) => {
    const nextPath = [...path, node];
    if (String(node.id) === String(dialectId)) {
      matchedPath = nextPath;
      return true;
    }
    const childPath = findDialectPath(node.children, dialectId, nextPath);
    if (!childPath.length) return false;
    matchedPath = childPath;
    return true;
  });
  return matchedPath;
}
