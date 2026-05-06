// tests/fixtures/zustandComponent.tsx
// Simulates Zustand setState / useStore patterns
import React from 'react';

// Simulate zustand's create pattern
declare function useStore(): { user: any; set: (s: any) => void };

export function ZustandWriter({ mockData }: { mockData: any }) {
  const { set } = useStore();

  const handleLoad = () => {
    // Zustand setState with an object — should be detected as a WRITE
    set({ user: mockData, cart: [] });
  };

  return <button onClick={handleLoad}>Load Zustand</button>;
}

export function ZustandReader() {
  // Destructured read — should be detected as READs for "user" and "cart"
  const { user } = useStore();

  return <div>{user?.email}</div>;
}
