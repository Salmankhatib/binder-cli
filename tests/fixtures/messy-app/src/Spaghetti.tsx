import React, { useState } from 'react';

export function SpaghettiComponent() {
  // Terrible variable names and mock
  const [data1, setData1] = useState<any>([
    { identifier: '123', val: 'Test1', status: 'ACTIVE' },
    { identifier: '456', val: 'Test2', status: 'INACTIVE' }
  ]);

  const toggle = (id: string) => {
    // Messy inline mutation
    const x = [...data1];
    const idx = x.findIndex(y => y.identifier === id);
    if(idx > -1) {
      x[idx].status = x[idx].status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      setData1(x);
    }
  };

  const a = data1.filter((b: any) => b.status === 'ACTIVE').map((c: any) => c.val);

  return (
    <div>
      <ul>
        {a.map((item: any, i: number) => <li key={i}>{item}</li>)}
      </ul>
      <button onClick={() => toggle('123')}>Toggle</button>
    </div>
  );
}
