import React from 'react';

// A deeply nested component that receives the mock via props
function DeepestChild({ userData, onUpdate }: { userData: any, onUpdate: any }) {
  return (
    <div>
      <h1>{userData.name}</h1>
      <button onClick={() => onUpdate({ ...userData, name: 'Updated' })}>Update</button>
    </div>
  );
}

function MiddleChild({ info, handleModify }: { info: any, handleModify: any }) {
  return <DeepestChild userData={info} onUpdate={handleModify} />;
}

export function DeepNestingParent() {
  // Mock data definition
  const mockUserList = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' }
  ];

  const updateMockUser = (user: any) => {
    console.log("Updating", user);
  }

  return (
    <div>
      {mockUserList.map(u => (
        <MiddleChild key={u.id} info={u} handleModify={updateMockUser} />
      ))}
    </div>
  );
}
