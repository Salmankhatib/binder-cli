import React from 'react';
import { useGetUsers, useGetTasks, useGetOldLegacyData } from './api';

export function UserProfile() {
  const { data: users } = useGetUsers();
  const { data: tasks } = useGetTasks();
  const { data: legacy } = useGetOldLegacyData();

  return (
    <div>
      {/* DRIFT: schema has fullName, code uses name */}
      <h1>{users?.name}</h1>
      <p>{users?.email}</p>

      {/* NO DRIFT: tasks has title and completed */}
      <ul>
        {tasks?.map(task => (
          <li key={task.title}>{task.title}</li>
        ))}
      </ul>

      {/* DRIFT: useGetOldLegacyData is missing from schema */}
      <div>{legacy?.id}</div>
    </div>
  );
}
