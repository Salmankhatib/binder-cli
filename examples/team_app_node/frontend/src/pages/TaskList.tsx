import React, { useState } from 'react';

const MOCK_TASKS = [
  { id: 1, title: 'Mock Task 1', description: 'Description 1', status: 'todo', assignedTo: 'User 1' },
  { id: 2, title: 'Mock Task 2', description: 'Description 2', status: 'done', assignedTo: 'User 2' },
];

export default function TaskList() {
  const [tasks, setTasks] = useState(MOCK_TASKS);

  const handleAddTask = () => {
    const newTask = { id: tasks.length + 1, title: 'New Task', description: '...', status: 'todo', assignedTo: 'Me' };
    setTasks([...tasks, newTask]);
  };

  const handleRemoveTask = (id: number) => {
    setTasks(tasks.filter(t => t.id !== id));
  };

  return (
    <div style={{ padding: '20px' }}>
      <h1>Project Tasks</h1>
      <button onClick={handleAddTask} style={{ marginBottom: '10px' }}>Add Task</button>
      <div className="task-list">
        {tasks.map(task => (
          <div key={task.id} style={{ border: '1px solid #ddd', padding: '10px', marginBottom: '10px' }}>
            <h4>{task.title}</h4>
            <p>{task.description}</p>
            <p><strong>Status:</strong> {task.status} | <strong>Owner:</strong> {task.assignedTo}</p>
            <button onClick={() => handleRemoveTask(task.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
