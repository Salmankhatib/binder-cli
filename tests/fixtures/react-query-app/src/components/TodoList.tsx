import { useQuery } from '@tanstack/react-query';

// This is the mock data - your tool should find and replace this
/* TODO(BINDER): Auto-conversion failed. Manual review required. */
/* TODO(BINDER): Auto-conversion failed. Manual review required. */
const MOCK_TODOS = [
  { id: 1, text: "Buy groceries", completed: false },
  { id: 2, text: "Walk the dog", completed: true },
  { id: 3, text: "Write code", completed: false }
];

export function TodoList() {
  // This is a mock useQuery - your tool should replace this
  const { data: todos } = useQuery({
    queryKey: ['todos'],
    queryFn: () => Promise.resolve(MOCK_TODOS)
  });

  return (
    <div>
      <h1>My Todos</h1>
      <ul>
        {todos?.map(todo => (
          <li key={todo.id}>
            {todo.text} - {todo.completed ? 'Done' : 'Pending'}
          </li>
        ))}
      </ul>
    </div>
  );
}