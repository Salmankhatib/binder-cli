// tests/fixtures/e2e-final-check.tsx
import React from 'react';
const MOCK_FINAL_DATA = [{ id: 1, name: 'Final' }];

export const FinalCheck = () => {
  return (
    <div>
      {MOCK_FINAL_DATA.map(item => <div key={item.id}>{item.name}</div>)}
    </div>
  );
};
