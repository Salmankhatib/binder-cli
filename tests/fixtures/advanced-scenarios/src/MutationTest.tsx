// tests/fixtures/advanced-scenarios/src/MutationTest.tsx
import React, { useState } from 'react';

const MOCK_PROJECTS = [{ id: '1', name: 'Binder' }];

export const MutationTest = () => {
  const [projects, setProjects] = useState(MOCK_PROJECTS);

  const addProject = () => {
    const newProject = { id: '2', name: 'New Project' };
    // Pattern 4.2: setUsers([...users, newUser]) -> trpc.project.create.useMutation()
    setProjects([...projects, newProject]);
  };

  const removeProject = (id) => {
    setProjects(projects.filter(p => p.id !== id));
  };

  return (
    <div>
      {projects.map(p => <div key={p.id}>{p.name}</div>)}
      <button onClick={addProject}>Add</button>
    </div>
  );
};
