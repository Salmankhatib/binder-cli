import React from 'react';

// Mocks
const MOCK_STATS = {
  totalTasks: 10,
  completedTasks: 5,
  pendingTasks: 5,
  teamMembers: 3
};

export default function Dashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Team Dashboard</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h3>Total</h3>
          <p>{MOCK_STATS.totalTasks}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h3>Done</h3>
          <p>{MOCK_STATS.completedTasks}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h3>Pending</h3>
          <p>{MOCK_STATS.pendingTasks}</p>
        </div>
        <div style={{ border: '1px solid #ccc', padding: '10px' }}>
          <h3>Team</h3>
          <p>{MOCK_STATS.teamMembers}</p>
        </div>
      </div>
    </div>
  );
}
