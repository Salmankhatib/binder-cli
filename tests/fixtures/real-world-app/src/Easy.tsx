// tests/fixtures/real-world-app/src/Easy.tsx
import React from 'react';

const MOCK_STATS = { users: 100, revenue: 5000 };
const MOCK_LOGS = ['login', 'logout', 'update'];

export const Dashboard = () => {
  const stats = MOCK_STATS;
  const logCount = MOCK_LOGS.length;
  
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Users: {stats.users}</p>
      <p>Logs: {logCount}</p>
      <ul>
        {MOCK_LOGS.map(log => <li key={log}>{log}</li>)}
      </ul>
    </div>
  );
};
