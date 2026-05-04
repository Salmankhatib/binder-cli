// tests/fixtures/real-world-app/src/RealWorld.tsx
import React, { useState, useMemo } from 'react';

const MOCK_USERS = [
  { id: 1, name: 'Alice', role: 'admin' },
  { id: 2, name: 'Bob', role: 'user' },
  { id: 3, name: 'Charlie', role: 'user' },
];

export const UserList = ({ onSelect }) => {
  const [page, setPage] = useState(0);
  const size = 10;
  
  // Pattern: slice-pagination -> Human Decision
  const users = useMemo(() => 
    MOCK_USERS.slice(page * size, (page + 1) * size),
    [page]
  );

  // Pattern: filter-simple -> Auto
  const admins = MOCK_USERS.filter(u => u.role === 'admin');

  return (
    <div>
      <h2>Users</h2>
      {users.map(u => (
        <div key={u.id} onClick={() => onSelect(u)}>
          {u.name} ({u.role})
        </div>
      ))}
      <p>Total Admins: {admins.length}</p>
    </div>
  );
};

export const UserManager = () => {
  // Pattern: prop-drill-shallow -> Human Decision
  return <UserList onSelect={(u) => console.log(u)} />;
};
