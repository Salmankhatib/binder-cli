// tests/fixtures/advanced-scenarios/src/CleanProduction2.tsx
import React from 'react';
const MOCK_CATEGORIES = ['Tech', 'Design', 'Marketing'];
const MOCK_USER_ROLE = 'ADMIN';

export const CategoryList = () => {
  return (
    <ul>
      {MOCK_CATEGORIES.map(c => <li key={c}>{c}</li>)}
    </ul>
  );
};

export const AdminCheck = () => {
  if (MOCK_USER_ROLE === 'ADMIN') return <div>Welcome Admin</div>;
  return <div>Welcome User</div>;
};

// tests/fixtures/advanced-scenarios/src/ComponentProps.tsx
import React from 'react';
const MOCK_THEME_COLOR = '#ff0000';
export const ThemedBox = ({ color = MOCK_THEME_COLOR }) => {
  return <div style={{ backgroundColor: color }}>Box</div>;
};
