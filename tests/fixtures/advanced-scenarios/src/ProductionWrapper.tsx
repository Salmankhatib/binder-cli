// tests/fixtures/advanced-scenarios/src/ProductionWrapper.tsx
import React from 'react';

// Custom wrapper hook (to be indexed)
export function useProjectData() {
    return useGetProjects();
}

const MOCK_PROJECTS = [{ id: '1', name: 'Binder' }];

export const ProductionComponent = () => {
    // Should be matched to useProjectData instead of a raw hook if it wraps the right one
    const projects = MOCK_PROJECTS;

    return (
        <div>
            {projects.map(p => <div key={p.id}>{p.name}</div>)}
        </div>
    );
};
