// tests/fixtures/reduxComponent.tsx
// Simulates a real Redux dispatch pattern
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

// Action creator (simulating a generated slice)
const setUser = (data: any) => ({ type: 'user/setUser', payload: data });
const setSettings = (data: any) => ({ type: 'settings/setSettings', payload: data });

export function WriterComponent({ mockData }: { mockData: any }) {
  const dispatch = useDispatch();

  const handleLoad = () => {
    // This is where mock data gets pushed into global Redux state
    dispatch(setUser(mockData));
    dispatch(setSettings({ theme: 'dark' }));
  };

  return <button onClick={handleLoad}>Load</button>;
}

export function ReaderComponent() {
  // These useSelector calls should be detected as consumers
  const user = useSelector((state: any) => state.user.data);
  const settings = useSelector((state: any) => state.settings);

  return (
    <div>
      <p>{user?.name}</p>
      <p>{settings?.theme}</p>
    </div>
  );
}
