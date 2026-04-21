import { useState } from 'react';
import { useGetAllUsersUsersAllGet } from "../../../src/generated/api";

// Mismatching mock data structure
const MOCK_USER_LIST = [
  { id: "101", name: "Mock User One", email: "mock1@test.com", role: "guest" },
  { id: "102", name: "Mock User Two", email: "mock2@test.com", role: "editor" }
];

export default function UsersManager() {
    const { data: MOCK_USER_LIST, isLoading: MOCK_USER_LISTLoading } = useGetAllUsersUsersAllGet();
  const [users, setUsers] = useState(MOCK_USER_LIST);

  // Intentional "Robustness" hurdles:
  // 1. Logic depends on 'id' but backend has 'uid'
  // 2. Logic depends on 'name' but backend has 'fullName'
  // 3. Logic depends on 'role' but backend has 'role_type'

  const handleDelete = (id: string) => {
    // This will need to be bound to useRemoveUserApiUsersRemoveUserIdDelete
    console.log("Deleting", id);
  };

  return (
    <div className="p-4">
      <h1>User Management</h1>
      
      <div className="grid gap-4">
        {users.map(user => {
          // HURDLE: Hook called inside a map! 
          // The ComponentBoundaryScanner should move this to the top.
          // if (user.id === "101") { const data = useGetSales(); } // Logic trap

          return (
            <div key={user.id} className="border p-2">
              <p>Name: {user.name}</p>
              <p>Email: {user.email}</p>
              <p>Role: {user.role}</p>
              <button 
                onClick={() => handleDelete(user.id)}
                className="bg-red-500 text-white px-2 py-1 rounded"
              >
                Delete
              </button>
            </div>
          );
        })}
      </div>

      <button 
        onClick={() => {
          // HURDLE: Inlined complex object addition
          const newUser = { id: "999", name: "New guy", email: "new@new.com", role: "user" };
          setUsers([...users, newUser]);
        }}
        className="mt-4 bg-blue-500 text-white p-2"
      >
        Add User
      </button>
    </div>
  );
}
