// tests/fixtures/advanced-scenarios/src/GoodProduction.tsx
import React, { useMemo, useCallback } from 'react';

const MOCK_PROJECT_LIST = [
  { id: 'p1', name: 'Alpha', status: 'ACTIVE' },
  { id: 'p2', name: 'Beta', status: 'ARCHIVED' }
];

const MOCK_CURRENT_USER = { id: 'u1', name: 'Dev Lead', role: 'ADMIN' };

export const ProjectDashboard = () => {
  // Pattern: direct-assignment -> Auto
  const projects = MOCK_PROJECT_LIST;
  
  // Pattern: computed-derivative -> Auto
  const activeProjects = useMemo(() => 
    projects.filter(p => p.status === 'ACTIVE'),
    [projects]
  );

  // Pattern: every-some -> Auto
  const hasArchived = useMemo(() => 
    projects.some(p => p.status === 'ARCHIVED'),
    [projects]
  );

  const handleProjectClick = useCallback((projectId: string) => {
    // Pattern: find-by-id -> Auto
    const project = projects.find(p => p.id === projectId);
    console.log('Clicked:', project?.name);
  }, [projects]);

  return (
    <div>
      <h1>Projects for {MOCK_CURRENT_USER.name}</h1>
      <ul>
        {activeProjects.map(p => (
          <li key={p.id} onClick={() => handleProjectClick(p.id)}>{p.name}</li>
        ))}
      </ul>
      {hasArchived && <p>Archive contains projects.</p>}
    </div>
  );
};
