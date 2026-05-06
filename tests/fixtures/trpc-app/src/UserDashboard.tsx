// tests/fixtures/trpc-app/src/UserDashboard.tsx
import React, { useState } from 'react';

const MOCK_USERS = [
  { id: '1', name: 'Alice' },
  { id: '2', name: 'Bob' }
];

export const UserDashboard = () => {
  // Pattern: direct-assignment -> Auto (user.list)
  const users = MOCK_USERS;

  return (
    <div>
      <h1>Users</h1>
      {users.map(u => <div key={u.id}>{u.name}</div>)}
    </div>
  );
};

export const UserProfile = ({ userId }) => {
  // Pattern: input-inference -> Auto (user.getById with input {id: userId})
  const MOCK_USER = { id: '1', name: 'Alice', email: 'alice@example.com' };
  
  return (
    <div>
      <h2>{MOCK_USER.name}</h2>
      <p>{MOCK_USER.email}</p>
    </div>
  );
};
