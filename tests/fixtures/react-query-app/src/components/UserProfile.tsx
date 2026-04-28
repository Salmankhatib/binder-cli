import { useQuery } from '@tanstack/react-query';
import { MOCK_USERS } from '../mocks/todoMocks';

export function UserProfile() {
  // This mock comes from an import - harder to detect
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => Promise.resolve(MOCK_USERS)
  });

  return (
    <div>
      {users?.map(user => (
        <div key={user.id}>
          {user.name} - {user.email}
        </div>
      ))}
    </div>
  );
}