// tests/fixtures/real-world-app/src/Messy.tsx
import React, { useEffect } from 'react';

const MOCK_VERY_COMPLEX_DATA = {
  deep: {
    nested: {
      items: [
        { id: 'a', metadata: { type: 'X', value: 10 } },
        { id: 'b', metadata: { type: 'Y', value: 20 } }
      ]
    }
  }
};

const handleUpdate = (id, val) => {
  console.log('Update', id, val);
};

export const ComplexComponent = () => {
  // Pattern: mock-with-logic -> Human/TODO if too complex
  const processed = MOCK_VERY_COMPLEX_DATA.deep.nested.items
    .filter(i => i.metadata.type === 'X')
    .map(i => ({ ...i, calculated: i.metadata.value * 2 }))
    .reduce((acc, curr) => ({ ...acc, [curr.id]: curr }), {});

  useEffect(() => {
    // Pattern: side-effect-mock -> TODO
    if (processed['a'] && MOCK_VERY_COMPLEX_DATA) {
      handleUpdate('a', processed['a'].calculated);
      window.localStorage.setItem('last_update', Date.now().toString());
    }
  }, [processed]);

  return (
    <div>
      <pre>{JSON.stringify(processed, null, 2)}</pre>
    </div>
  );
};
