// tests/fixtures/real-world-app/src/Settings.tsx
import React from 'react';
const MOCK_SETTINGS = { theme: 'dark', notifications: true };
export const Settings = () => {
  const settings = MOCK_SETTINGS;
  return <div>{settings.theme}</div>;
};

// tests/fixtures/real-world-app/src/Invoices.tsx
import React from 'react';
const MOCK_INVOICES = [{ id: '1', amount: 100, status: 'paid' }];
export const Invoices = () => {
  return <div>{MOCK_INVOICES.length} invoices</div>;
};

// tests/fixtures/real-world-app/src/Profile.tsx
import React from 'react';
const MOCK_USER_PROFILE = { name: 'John', email: 'john@example.com' };
export const Profile = () => {
  const { name, email } = MOCK_USER_PROFILE;
  return <div>{name} ({email})</div>;
};

// tests/fixtures/real-world-app/src/Notifications.tsx
import React from 'react';
const MOCK_NOTIFS = ['New msg', 'Task done'];
export const Notifications = () => {
  return <ul>{MOCK_NOTIFS.map(n => <li key={n}>{n}</li>)}</ul>;
};

// tests/fixtures/real-world-app/src/ReportChart.tsx
import React from 'react';
const MOCK_CHART_DATA = [{ label: 'Jan', value: 10 }, { label: 'Feb', value: 20 }];
export const ReportChart = () => {
  const chartData = MOCK_CHART_DATA.map(d => ({ ...d, value: d.value * 2 }));
  return <div>Chart</div>;
};

// tests/fixtures/real-world-app/src/UserDetail.tsx
import React, { useEffect, useState } from 'react';
const MOCK_USER_DETAIL = { id: 1, name: 'Alice', bio: '...' };
export const UserDetail = ({ id }) => {
  const [user, setUser] = useState(MOCK_USER_DETAIL);
  return <div>{user.name}</div>;
};

// tests/fixtures/real-world-app/src/AdminLogs.tsx
import React from 'react';
const MOCK_ADMIN_LOGS = ['init', 'auth'];
export const AdminLogs = () => {
  if (!MOCK_ADMIN_LOGS) return <div>Loading...</div>;
  return <div>{MOCK_ADMIN_LOGS.length} logs</div>;
};

// tests/fixtures/real-world-app/src/ConfigTable.tsx
import React from 'react';
const MOCK_TABLE_COLS = { id: 'ID', name: 'Name' };
export const ConfigTable = () => {
  const columns = { ...MOCK_TABLE_COLS, action: 'Actions' };
  return <div>Table</div>;
};

// tests/fixtures/real-world-app/src/GlobalSearch.tsx
import React from 'react';
const MOCK_SEARCH_RESULTS = [{ title: 'Home' }];
export const GlobalSearch = () => {
  const filtered = MOCK_SEARCH_RESULTS.filter(r => r.title.includes('H'));
  return <div>{filtered.length}</div>;
};

// tests/fixtures/real-world-app/src/AuthGuard.tsx
import React from 'react';
const MOCK_AUTH_USER = { isAdmin: true };
export const AuthGuard = ({ children }) => {
  if (MOCK_AUTH_USER.isAdmin) return <>{children}</>;
  return <div>Access Denied</div>;
};

// tests/fixtures/real-world-app/src/ThemeToggle.tsx
import React from 'react';
const MOCK_THEME = 'light';
export const ThemeToggle = () => {
  const current = MOCK_THEME === 'dark' ? 'Moon' : 'Sun';
  return <button>{current}</button>;
};
