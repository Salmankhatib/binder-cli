// tests/fixtures/advanced-scenarios/src/ExtremelyHard.tsx
import React, { useState, useEffect } from 'react';

const MOCK_COMPLEX_TREE = {
  nodes: [
    { id: '1', children: ['2', '3'], data: { meta: 'root' } },
    { id: '2', children: [], data: { meta: 'leaf' } }
  ]
};

const MOCK_CONFIG_BLOB = "{\"enabled\": true, \"version\": \"1.0\"}";

export const HardComponent = () => {
  // Pattern: useState-mock-init-no-setter -> Auto (migration to useQuery)
  const [tree, setTree] = useState(MOCK_COMPLEX_TREE);
  
  // Pattern: mock-with-logic -> Human (JSON parsing + complex tree walking)
  const config = JSON.parse(MOCK_CONFIG_BLOB);
  
  // Recursive tree walking - Extremely complex for AST
  const findNode = (id, nodes) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children && node.children.length > 0) {
        const found = findNode(id, node.children);
        if (found) return found;
      }
    }
    return null;
  };

  // Pattern: computed-chain -> Auto/Human (depends on complexity detection)
  const leafNodes = tree.nodes
    .filter(n => n.children.length === 0)
    .map(n => n.id);

  useEffect(() => {
    if (config.enabled) {
      console.log('Tree loaded', tree.nodes.length);
      // Risky side effect: triggers SideEffectMockPattern -> TODO
      window.localStorage.setItem('tree_cache', JSON.stringify(MOCK_COMPLEX_TREE));
    }
  }, [config, tree]);

  return (
    <div>
      {leafNodes.map(id => (
        <div key={id}>Leaf: {findNode(id, tree.nodes)?.data.meta}</div>
      ))}
    </div>
  );
};
