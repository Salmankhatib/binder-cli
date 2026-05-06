import React from 'react';

// Simulating an existing real hook
const useGetProjectsQuery = () => {
    return { data: [{ id: 1, name: 'Real Project' }], isLoading: false };
}

export function MixedComponent() {
  // This is already bound to a real API!
  const { data: realProjects, isLoading } = useGetProjectsQuery();

  // But this is still a mock that needs binding
  const mockAdminData = {
    role: 'SUPER_ADMIN',
    permissions: ['READ', 'WRITE']
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <h1>Projects</h1>
      <ul>
        {realProjects?.map(p => <li key={p.id}>{p.name}</li>)}
      </ul>
      
      {mockAdminData.role === 'SUPER_ADMIN' && (
        <button>Admin Action</button>
      )}
    </div>
  );
}
