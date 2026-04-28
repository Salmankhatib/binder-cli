import React, { useState } from 'react';

//  Mock data and functions to simulate API interactions
const MOCK_PROJECT_LIST = [
  { id: 1, name: "Mock Project Alpha", status: "stable", version: "1.0.0" },
  { id: 2, name: "Mock Project Beta", status: "beta", version: "0.5.0" }
];

const MOCK_USER_PROFILE = {
  username: "demo_user",
  level: "Beginner",
  lastLogin: "2026-04-20T10:00:00Z"
};

export default function NodeDashboard() {
  const [projects, setProjects] = useState(MOCK_PROJECT_LIST);
  const [user] = useState(MOCK_USER_PROFILE);

  const handleDeleteProject = (id: number) => {
    // This should be bound to useDeleteProjectsId
    console.log("Requesting deletion for project:", id);
    setProjects(prev => prev.filter(p => p.id !== id));
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ borderBottom: '2px solid #eee', marginBottom: '20px' }}>
        <h1>{user.username}'s Dashboard</h1>
        <p>Level: <strong>{user.level}</strong> | Last Seen: {user.lastLogin}</p>
      </header>

      <section>
        <h2>Active Projects</h2>
        <div style={{ display: 'grid', gap: '15px' }}>
          {projects.map(proj => (
            <div key={proj.id} style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 5px 0' }}>{proj.name}</h4>
                  <small>Status: {proj.status} | v{proj.version}</small>
                </div>
                <button 
                  onClick={() => handleDeleteProject(proj.id)}
                  style={{ backgroundColor: '#ff4444', color: 'white', border: 'none', padding: '5px 10px', borderRadius: '4px', cursor: 'pointer' }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
