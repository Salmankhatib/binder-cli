// ============================================================================
// BINDER-CLI TORTURE TEST & ENHANCEMENT SPEC
// Version: 1.0.0
// Purpose: Force binder-cli to handle real production code correctly
// Author: Generated for Salmankhatib/binder-cli
// ============================================================================
//
// INSTRUCTIONS FOR COPILOT:
// 1. This file contains test fixtures that binder-cli MUST handle correctly
// 2. Each fixture has an EXPECTED verdict: AUTO / HUMAN / TODO
// 3. If binder-cli gets it wrong, the corresponding feature must be implemented
// 4. Use this as a roadmap for missing features
//
// CURRENT GAPS IN BINDER-CLI (v1.0.0):
// - No usage-pattern analysis (useState, useEffect, prop-drill detection)
// - No loading-state injection (isLoading, error handling)
// - No cross-file prop tracking
// - No derived-data detection (filter/map/reduce chains)
// - No imperative DOM detection (canvas, refs, direct DOM)
// - No auth/conditional-flow analysis
// - Score system uses Math.max instead of weighted ensemble
// - No negative scoring for dangerous patterns
//
// ============================================================================

// =============================================================================
// SECTION 1: AUTO CASES (Should be 100% automatic — safe, simple, mechanical)
// =============================================================================
// These MUST auto-bind. If binder-cli fails any of these, the matcher is broken.

// --- AUTO-001: Direct property access in JSX ---
// src/components/UserBadge.tsx
import React from 'react';
const MOCK_USER = { id: 1, name: 'Alice', avatar: 'https://cdn.example.com/a.jpg', status: 'online' };
export const UserBadge = () => {
  return (
    <div className="badge">
      <img src={MOCK_USER.avatar} alt={MOCK_USER.name} />
      <span className={MOCK_USER.status}>{MOCK_USER.name}</span>
      <small>ID: {MOCK_USER.id}</small>
    </div>
  );
};
// EXPECTED: AUTO → useGetUser() or similar
// REASON: Only direct property access in render. No state, no effects, no methods.

// --- AUTO-002: Simple list map with key ---
// src/components/OrderList.tsx
import React from 'react';
const MOCK_ORDERS = [
  { id: 'ORD-001', total: 99.99, status: 'shipped' },
  { id: 'ORD-002', total: 149.50, status: 'pending' }
];
export const OrderList = () => {
  return (
    <ul className="orders">
      {MOCK_ORDERS.map(order => (
        <li key={order.id} className={`order-${order.status}`}>
          <span>{order.id}</span>
          <span>${order.total.toFixed(2)}</span>
        </li>
      ))}
    </ul>
  );
};
// EXPECTED: AUTO → useGetOrders()
// REASON: Pure render loop. No derived computation. No state mutation.

// --- AUTO-003: Destructuring then render ---
// src/components/ProfileCard.tsx
import React from 'react';
const MOCK_PROFILE = { name: 'Bob', email: 'bob@example.com', bio: 'Developer', joined: '2023-01-15' };
export const ProfileCard = () => {
  const { name, email, bio, joined } = MOCK_PROFILE;
  return (
    <div className="profile">
      <h2>{name}</h2>
      <p>{bio}</p>
      <a href={`mailto:${email}`}>{email}</a>
      <time>Joined: {joined}</time>
    </div>
  );
};
// EXPECTED: AUTO → useGetProfile()
// REASON: Destructuring is just syntactic sugar for direct access. Still safe.

// --- AUTO-004: Conditional rendering with boolean ---
// src/components/FeatureFlag.tsx
import React from 'react';
const MOCK_FEATURES = { darkMode: true, betaAccess: false, notifications: true };
export const FeatureFlag = () => {
  return (
    <div>
      {MOCK_FEATURES.darkMode && <DarkModeToggle />}
      {MOCK_FEATURES.betaAccess ? <BetaBanner /> : <StandardBanner />}
      <NotificationBell enabled={MOCK_FEATURES.notifications} />
    </div>
  );
};
// EXPECTED: AUTO → useGetFeatures()
// REASON: Boolean conditionals in JSX are render-only. Safe to replace.

// --- AUTO-005: String template in JSX ---
// src/components/AddressDisplay.tsx
import React from 'react';
const MOCK_ADDRESS = { street: '123 Main St', city: 'Boston', zip: '02101' };
export const AddressDisplay = () => {
  return (
    <address>
      {MOCK_ADDRESS.street}, {MOCK_ADDRESS.city} {MOCK_ADDRESS.zip}
    </address>
  );
};
// EXPECTED: AUTO → useGetAddress()
// REASON: String interpolation in JSX is render-only.

// =============================================================================
// SECTION 2: HUMAN CASES (Requires developer judgment — ambiguous, contextual)
// =============================================================================
// These MUST NOT auto-bind. Binder should flag for human review with explanation.

// --- HUMAN-001: Derived data with .filter() ---
// src/components/ActiveUsers.tsx
import React from 'react';
const MOCK_ALL_USERS = [
  { id: 1, name: 'Alice', active: true },
  { id: 2, name: 'Bob', active: false },
  { id: 3, name: 'Charlie', active: true }
];
export const ActiveUsers = () => {
  const activeUsers = MOCK_ALL_USERS.filter(u => u.active);
  return (
    <div>
      <h3>Active Users ({activeUsers.length})</h3>
      {activeUsers.map(u => <div key={u.id}>{u.name}</div>)}
    </div>
  );
};
// EXPECTED: HUMAN
// REASON: .filter() is derived state. Options:
//   A) Keep client-side (add useMemo)
//   B) Move to server (add ?active=true param)
//   C) API already filters (just bind and remove .filter())
// Binder cannot know which. Needs human decision.

// --- HUMAN-002: Derived data with .reduce() ---
// src/components/RevenueSummary.tsx
import React from 'react';
const MOCK_TRANSACTIONS = [
  { id: 1, amount: 100, currency: 'USD' },
  { id: 2, amount: 250, currency: 'USD' },
  { id: 3, amount: 75, currency: 'EUR' }
];
export const RevenueSummary = () => {
  const totalUSD = MOCK_TRANSACTIONS
    .filter(t => t.currency === 'USD')
    .reduce((sum, t) => sum + t.amount, 0);
  return <div>Total USD Revenue: ${totalUSD}</div>;
};
// EXPECTED: HUMAN
// REASON: Chain of filter+reduce. Could be:
//   A) Backend should aggregate (new endpoint)
//   B) Keep client-side with useMemo
//   C) React Query select transformer
// Human must decide architecture.

// --- HUMAN-003: Client-side pagination ---
// src/components/PaginatedProducts.tsx
import React, { useState } from 'react';
const MOCK_PRODUCTS = Array.from({ length: 150 }, (_, i) => ({
  id: i + 1,
  name: `Product ${i + 1}`,
  price: 10 + i
}));
export const PaginatedProducts = () => {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const visible = MOCK_PRODUCTS.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(MOCK_PRODUCTS.length / pageSize);
  return (
    <div>
      {visible.map(p => <div key={p.id}>{p.name}: ${p.price}</div>)}
      <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
      <span>Page {page} of {totalPages}</span>
      <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
    </div>
  );
};
// EXPECTED: HUMAN
// REASON: .slice() pagination. Options:
//   A) Keep client-side (small dataset)
//   B) Convert to server-side pagination (useGetProducts({ page, pageSize }))
//   C) Use infinite scroll / useInfiniteQuery
// Human must decide based on dataset size and UX requirements.

// --- HUMAN-004: Form defaults (spread into state) ---
// src/components/SettingsForm.tsx
import React, { useState } from 'react';
const MOCK_DEFAULTS = { theme: 'dark', language: 'en', notifications: true };
export const SettingsForm = () => {
  const [settings, setSettings] = useState({ ...MOCK_DEFAULTS });
  return (
    <form>
      <select value={settings.theme} onChange={e => setSettings({...settings, theme: e.target.value})}>
        <option>light</option>
        <option>dark</option>
      </select>
      <label>
        <input type="checkbox" checked={settings.notifications} onChange={e => setSettings({...settings, notifications: e.target.checked})} />
        Enable notifications
      </label>
    </form>
  );
};
// EXPECTED: HUMAN
// REASON: Mock is spread into useState. Not direct init, but close.
//   A) Could bind to useGetSettings() as default
//   B) Could keep defaults static (no API call needed)
//   C) Need to handle form submission (mutation)
// Human decides if this needs an API at all.

// --- HUMAN-005: Search with query prop ---
// src/components/SearchResults.tsx
import React from 'react';
const MOCK_ITEMS = [
  { id: 1, title: 'React Patterns', tags: ['react', 'frontend'] },
  { id: 2, title: 'Node.js Guide', tags: ['node', 'backend'] },
  { id: 3, title: 'CSS Tricks', tags: ['css', 'frontend'] }
];
export const SearchResults = ({ query, category }) => {
  const filtered = MOCK_ITEMS.filter(item => {
    const matchesQuery = item.title.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = !category || item.tags.includes(category);
    return matchesQuery && matchesCategory;
  });
  return (
    <div>
      <p>{filtered.length} results</p>
      {filtered.map(item => <div key={item.id}>{item.title}</div>)}
    </div>
  );
};
// EXPECTED: HUMAN
// REASON: Search with external query prop. Options:
//   A) Client-side filter (keep as-is, bind mock only)
//   B) Server-side search (useSearchItems({ query, category }))
//   C) Debounced search with React Query
// Human must decide search architecture.

// =============================================================================
// SECTION 3: TODO CASES (Dangerous or impossible to auto-bind)
// =============================================================================
// These MUST NOT auto-bind. Binder should leave TODO with explanation.

// --- TODO-001: useState initializer with mock ---
// src/components/UserEditor.tsx
import React, { useState } from 'react';
const MOCK_USER = { id: 1, name: 'Alice', email: 'alice@example.com', role: 'admin' };
export const UserEditor = () => {
  const [formData, setFormData] = useState(MOCK_USER);
  const [isDirty, setIsDirty] = useState(false);
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };
  return (
    <form>
      <input value={formData.name} onChange={e => handleChange('name', e.target.value)} />
      <input value={formData.email} onChange={e => handleChange('email', e.target.value)} />
      <select value={formData.role} onChange={e => handleChange('role', e.target.value)}>
        <option>admin</option>
        <option>user</option>
      </select>
      {isDirty && <button>Save Changes</button>}
    </form>
  );
};
// EXPECTED: TODO
// REASON: useState(MOCK_USER) initializes form with static data.
// If replaced with useGetUser(), the form gets undefined on first render,
// then data loads, causing a flash and potential loss of user edits.
// Requires: loading guard + merge strategy + mutation hook.
// TOO COMPLEX for auto. Leave TODO with instructions.

// --- TODO-002: useEffect dependency on mock ---
// src/components/ActivityTracker.tsx
import React, { useEffect, useState } from 'react';
const MOCK_ACTIVITIES = [
  { id: 1, action: 'login', timestamp: Date.now() }
];
export const ActivityTracker = () => {
  const [activities, setActivities] = useState(MOCK_ACTIVITIES);
  useEffect(() => {
    const lastActivity = activities[activities.length - 1];
    if (lastActivity?.action === 'login') {
      analytics.track('user_active', { timestamp: lastActivity.timestamp });
    }
  }, [activities]);
  return (
    <ul>
      {activities.map(a => <li key={a.id}>{a.action} at {a.timestamp}</li>)}
    </ul>
  );
};
// EXPECTED: TODO
// REASON: useEffect depends on mock-derived state.
// Replacing mock with async hook changes timing:
//   - Effect runs with [] initially (activities = [])
//   - Then data loads, effect runs again
//   - Analytics fires twice or with wrong data
// Requires: effect logic rewrite + dependency analysis.
// TOO COMPLEX for auto. Leave TODO.

// --- TODO-003: Prop drilling mock to child ---
// src/components/Dashboard.tsx
import React from 'react';
const MOCK_STATS = { users: 1000, revenue: 50000, growth: 0.15 };
const StatCard = ({ title, value, format }) => {
  const display = format === 'percent' ? `${(value * 100).toFixed(0)}%` : value;
  return <div className="stat"><h4>{title}</h4><span>{display}</span></div>;
};
export const Dashboard = () => {
  return (
    <div className="dashboard">
      <StatCard title="Users" value={MOCK_STATS.users} format="number" />
      <StatCard title="Revenue" value={MOCK_STATS.revenue} format="currency" />
      <StatCard title="Growth" value={MOCK_STATS.growth} format="percent" />
    </div>
  );
};
// EXPECTED: TODO
// REASON: Mock is passed as props to child components.
// If only Dashboard is processed, StatCard still expects props.
// Requires: whole-tree analysis + prop removal + child component update.
// TOO COMPLEX for auto. Leave TODO with cross-file warning.

// --- TODO-004: Imperative DOM with canvas ---
// src/components/ChartRenderer.tsx
import React, { useEffect, useRef } from 'react';
const MOCK_CHART_DATA = [
  { label: 'Q1', value: 100 },
  { label: 'Q2', value: 150 },
  { label: 'Q3', value: 120 }
];
export const ChartRenderer = () => {
  const canvasRef = useRef(null);
  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;
    ctx.clearRect(0, 0, width, height);
    // Draw bars from mock data
    const barWidth = width / MOCK_CHART_DATA.length;
    const maxValue = Math.max(...MOCK_CHART_DATA.map(d => d.value));
    MOCK_CHART_DATA.forEach((d, i) => {
      const barHeight = (d.value / maxValue) * height * 0.8;
      ctx.fillRect(i * barWidth, height - barHeight, barWidth - 5, barHeight);
      ctx.fillText(d.label, i * barWidth + 5, height - 10);
    });
  }, []);
  return <canvas ref={canvasRef} width={600} height={400} />;
};
// EXPECTED: TODO
// REASON: Imperative canvas rendering inside useEffect.
// Data is consumed imperatively, not declaratively.
// Requires: chart library migration (recharts, chart.js React wrapper)
// or significant effect rewrite.
// TOO COMPLEX for auto. Leave TODO.

// --- TODO-005: Auth conditional with redirect ---
// src/components/ProtectedRoute.tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
const MOCK_AUTH = { isAuthenticated: true, user: { id: 1, role: 'admin' }, permissions: ['read', 'write', 'delete'] };
export const ProtectedRoute = ({ children, requiredRole, requiredPermission }) => {
  if (!MOCK_AUTH.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (requiredRole && MOCK_AUTH.user.role !== requiredRole) {
    return <Navigate to="/unauthorized" replace />;
  }
  if (requiredPermission && !MOCK_AUTH.permissions.includes(requiredPermission)) {
    return <div>Missing permission: {requiredPermission}</div>;
  }
  return <>{children}</>;
};
// EXPECTED: TODO
// REASON: Auth logic with routing side effects.
// Replacing mock with useAuth() hook changes:
//   - Redirect timing (async auth check)
//   - Flash of unauthorized content
//   - Route guard architecture
// Requires: auth context migration + loading state + error boundary.
// TOO COMPLEX for auto. Leave TODO.

// --- TODO-006: Mock data with methods (not plain objects) ---
// src/components/PaymentWidget.tsx
import React from 'react';
class MockPaymentGateway {
  constructor() { this.transactions = []; }
  processPayment(amount) { return { id: Math.random(), amount, status: 'success' }; }
  getHistory() { return this.transactions; }
}
const MOCK_GATEWAY = new MockPaymentGateway();
export const PaymentWidget = () => {
  const handlePay = () => {
    const result = MOCK_GATEWAY.processPayment(99.99);
    console.log('Payment processed:', result);
  };
  return (
    <div>
      <button onClick={handlePay}>Pay $99.99</button>
      <ul>
        {MOCK_GATEWAY.getHistory().map(t => <li key={t.id}>{t.amount}</li>)}
      </ul>
    </div>
  );
};
// EXPECTED: TODO
// REASON: Mock is a CLASS with METHODS, not plain data.
// API returns JSON. Methods don't exist in JSON.
// processPayment() should become useMutation.
// getHistory() should become useQuery.
// Requires: class-to-hooks refactoring. TOO COMPLEX.

// --- TODO-007: Recursive/nested tree with imperative rendering ---
// src/components/OrgChart.tsx
import React, { useEffect, useRef } from 'react';
const MOCK_ORG = {
  id: 'ceo',
  name: 'CEO',
  children: [
    { id: 'cto', name: 'CTO', children: [
      { id: 'dev1', name: 'Dev 1', children: [] },
      { id: 'dev2', name: 'Dev 2', children: [] }
    ]},
    { id: 'cfo', name: 'CFO', children: [
      { id: 'acc1', name: 'Accountant 1', children: [] }
    ]}
  ]
};
export const OrgChart = () => {
  const containerRef = useRef(null);
  useEffect(() => {
    const renderNode = (node, depth) => {
      const el = document.createElement('div');
      el.className = `org-node depth-${depth}`;
      el.textContent = node.name;
      el.style.marginLeft = `${depth * 20}px`;
      containerRef.current.appendChild(el);
      node.children?.forEach(child => renderNode(child, depth + 1));
    };
    renderNode(MOCK_ORG, 0);
  }, []);
  return <div ref={containerRef} className="org-chart" />;
};
// EXPECTED: TODO
// REASON: Recursive imperative DOM rendering.
// Requires: React recursive component rewrite or tree library.
// TOO COMPLEX for auto. Leave TODO.

// =============================================================================
// SECTION 4: EDGE CASES (Behavioral traps — test binder's safety)
// =============================================================================
// These test whether binder can detect subtle dangers.

// --- EDGE-001: Mock used as default parameter ---
// src/components/Greeting.tsx
import React from 'react';
const MOCK_DEFAULT_NAME = 'Guest';
export const Greeting = ({ name = MOCK_DEFAULT_NAME }) => {
  return <h1>Hello, {name}!</h1>;
};
// EXPECTED: HUMAN or TODO
// REASON: Default parameter is not "usage" in the same way.
// If bound to API, the default becomes async → undefined initially.
// But default params should stay static. Tricky case.

// --- EDGE-002: Mock shadowed by local variable ---
// src/components/Counter.tsx
import React, { useState } from 'react';
const MOCK_COUNT = 10;
export const Counter = () => {
  const [count, setCount] = useState(0);
  const displayCount = count || MOCK_COUNT;
  return <div>{displayCount}</div>;
};
// EXPECTED: HUMAN
// REASON: Mock is fallback value, not primary data.
// If bound to API, the fallback logic changes meaning.
// Needs human judgment on intent.

// --- EDGE-003: Mock in closure/callback ---
// src/components/Timer.tsx
import React, { useCallback } from 'react';
const MOCK_INTERVAL = 1000;
export const Timer = () => {
  const tick = useCallback(() => {
    console.log('Tick every', MOCK_INTERVAL, 'ms');
  }, []);
  return <button onClick={tick}>Start</button>;
};
// EXPECTED: TODO
// REASON: Mock in closure. If replaced with async hook,
// closure captures stale value or undefined.
// Requires: callback dependency rewrite.

// --- EDGE-004: Multiple mocks with interdependency ---
// src/components/ReportBuilder.tsx
import React from 'react';
const MOCK_USERS = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }];
const MOCK_ORDERS = [
  { id: 'O1', userId: 1, amount: 100 },
  { id: 'O2', userId: 1, amount: 200 },
  { id: 'O3', userId: 2, amount: 150 }
];
export const ReportBuilder = () => {
  const enriched = MOCK_USERS.map(user => ({
    ...user,
    totalSpent: MOCK_ORDERS
      .filter(o => o.userId === user.id)
      .reduce((sum, o) => sum + o.amount, 0)
  }));
  return (
    <table>
      {enriched.map(u => (
        <tr key={u.id}>
          <td>{u.name}</td>
          <td>${u.totalSpent}</td>
        </tr>
      ))}
    </table>
  );
};
// EXPECTED: TODO
// REASON: Two mocks with JOIN logic.
// Requires: backend relationship endpoint or GraphQL.
// Cannot auto-bind one without the other.

// --- EDGE-005: Mock with Date.now() or Math.random() ---
// src/components/Lottery.tsx
import React from 'react';
const MOCK_WINNERS = [
  { id: 1, name: 'Alice', drawnAt: Date.now() },
  { id: 2, name: 'Bob', drawnAt: Date.now() - 86400000 }
];
export const Lottery = () => {
  const latest = MOCK_WINNERS.sort((a, b) => b.drawnAt - a.drawnAt)[0];
  return <div>Latest winner: {latest.name} (drawn {new Date(latest.drawnAt).toLocaleString()})</div>;
};
// EXPECTED: HUMAN
// REASON: Date.now() in mock means data is generated at runtime.
// API should return real timestamps. But sorting logic might need useMemo.
// Human decides if client-side sort is correct.

// =============================================================================
// SECTION 5: REACT QUERY LOADING STATE INJECTION TESTS
// =============================================================================
// Binder MUST inject isLoading/error handling when auto-binding. If it doesn't,
// the component breaks on first render.

// --- LOADING-001: Simple component without loading guard ---
// src/components/SimpleUser.tsx
import React from 'react';
const MOCK_SIMPLE_USER = { name: 'Alice' };
export const SimpleUser = () => {
  return <div>{MOCK_SIMPLE_USER.name}</div>;
};
// EXPECTED: AUTO with loading guard injection
// CORRECT OUTPUT:
//   const { data, isLoading, error } = useGetSimpleUser();
//   if (isLoading) return <div>Loading...</div>;
//   if (error) return <div>Error: {error.message}</div>;
//   return <div>{data.name}</div>;
// IF BINDER OUTPUTS: return <div>{data.name}</div> without guards → FAIL

// --- LOADING-002: Component with existing conditional ---
// src/components/ConditionalUser.tsx
import React from 'react';
const MOCK_COND_USER = { name: 'Bob', isAdmin: true };
export const ConditionalUser = () => {
  if (!MOCK_COND_USER.isAdmin) return <div>Not admin</div>;
  return <div>Admin: {MOCK_COND_USER.name}</div>;
};
// EXPECTED: AUTO with merged loading guard
// CORRECT OUTPUT:
//   const { data, isLoading } = useGetConditionalUser();
//   if (isLoading) return <div>Loading...</div>;
//   if (!data?.isAdmin) return <div>Not admin</div>;
//   return <div>Admin: {data.name}</div>;
// IF BINDER OUTPUTS: if (!data.isAdmin) → FAIL (data is undefined initially)

// =============================================================================
// SECTION 6: SCORING SYSTEM VALIDATION
// =============================================================================
// These test whether the ensemble scorer produces correct confidence values.

// --- SCORE-001: Perfect match should score > 0.9 ---
// Mock: MOCK_USERS in file /pages/users/UserList.tsx
// Hook: useGetUsers (from generated API)
// Context: folder is "users", file is "UserList", imports include '@/features/users'
// EXPECTED: score >= 0.9, AUTO

// --- SCORE-002: Ambiguous match should score 0.4-0.6 ---
// Mock: MOCK_DATA in file /components/shared/Widget.tsx
// Hooks: useGetUsers, useGetOrders, useGetProducts (all equally likely)
// Context: no folder match, no import match
// EXPECTED: score 0.4-0.6, HUMAN (ambiguous)

// --- SCORE-003: Dangerous pattern should score < 0.3 ---
// Mock: MOCK_USER in useState(MOCK_USER)
// Hook: useGetUser (perfect name match, perfect shape match)
// EXPECTED: score < 0.3, TODO (useState initializer penalizes heavily)

// --- SCORE-004: Math.max vs weighted ensemble ---
// Heuristic: 0.95, Semantic: 0.1, Contextual: 0.1
// Math.max result: 0.95 (would AUTO)
// Weighted ensemble: 0.5*0.95 + 0.3*0.1 + 0.2*0.1 = 0.505 (would HUMAN)
// EXPECTED: Weighted ensemble is correct. Math.max is wrong.

// =============================================================================
// COPILOT IMPLEMENTATION CHECKLIST
// ============================================================================
//
// [ ] Usage Pattern Analyzer: Detect useState, useEffect, prop-pass, method-call
// [ ] Loading State Injector: Add isLoading/error guards to auto-bound components
// [ ] Derived Data Detector: Flag .filter/.map/.reduce chains for HUMAN review
// [ ] Cross-File Prop Tracker: Detect mock passed as prop to child components
// [ ] Imperative DOM Detector: Flag canvas, ref manipulation, document.* calls
// [ ] Auth/Conditional Analyzer: Flag routing/auth conditionals for TODO
// [ ] Negative Scoring: Penalize dangerous patterns in MatchScorer
// [ ] Weighted Ensemble: Replace Math.max with weighted combination
// [ ] TODO Comment Generator: Explain WHY a case is TODO (not just "complex")
// [ ] Loading Template Injection: Use config.loadingTemplate in generated guards
//
// ============================================================================