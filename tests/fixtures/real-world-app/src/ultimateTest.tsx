// ============================================
// REAL PRODUCTION CODE FIXTURES
// These represent actual patterns found in mature React codebases
// ============================================

// --- AUTO: Simple display data (safe to auto-bind) ---
// src/components/UserAvatar.tsx
import React from 'react';
const MOCK_USER = { id: 1, name: 'Alice', avatar: 'https://cdn.example.com/a.jpg' };
export const UserAvatar = () => {
  return (
    <div className="avatar">
      <img src={MOCK_USER.avatar} alt={MOCK_USER.name} />
      <span>{MOCK_USER.name}</span>
    </div>
  );
};

// src/components/OrderSummary.tsx  
import React from 'react';
const MOCK_ORDER = { id: 'ORD-123', total: 299.99, currency: 'USD' };
export const OrderSummary = () => {
  const { id, total, currency } = MOCK_ORDER;
  return (
    <div className="order-card">
      <h3>Order {id}</h3>
      <p className="price">{currency} {total.toFixed(2)}</p>
    </div>
  );
};

// src/pages/StatusPage.tsx
import React from 'react';
const MOCK_STATUS = { online: true, lastSeen: '2 min ago' };
export const StatusPage = () => {
  return (
    <div className={`status ${MOCK_STATUS.online ? 'green' : 'red'}`}>
      {MOCK_STATUS.online ? 'Online' : 'Offline'} • {MOCK_STATUS.lastSeen}
    </div>
  );
};

// --- AUTO: List rendering (safe if shape matches) ---
// src/components/ProductGrid.tsx
import React from 'react';
const MOCK_PRODUCTS = [
  { id: 1, name: 'Widget', price: 19.99 },
  { id: 2, name: 'Gadget', price: 29.99 }
];
export const ProductGrid = () => {
  return (
    <div className="grid">
      {MOCK_PRODUCTS.map(p => (
        <div key={p.id} className="product-card">
          <h4>{p.name}</h4>
          <p>${p.price}</p>
        </div>
      ))}
    </div>
  );
};

// src/components/NotificationList.tsx
import React from 'react';
const MOCK_NOTIFICATIONS = [
  { id: 'n1', message: 'New order', timestamp: '2024-01-15T10:00:00Z' },
  { id: 'n2', message: 'Shipped', timestamp: '2024-01-15T14:00:00Z' }
];
export const NotificationList = () => {
  return (
    <ul className="notifications">
      {MOCK_NOTIFICATIONS.map(n => (
        <li key={n.id}>
          <span>{n.message}</span>
          <time>{new Date(n.timestamp).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
};

// --- HUMAN: Derived/computed data (needs judgment) ---
// src/components/AnalyticsDashboard.tsx
import React from 'react';
const MOCK_SALES = [
  { month: 'Jan', amount: 5000 },
  { month: 'Feb', amount: 7000 },
  { month: 'Mar', amount: 6000 }
];
export const AnalyticsDashboard = () => {
  // Derived: total needs useMemo or stays computed?
  const totalRevenue = MOCK_SALES.reduce((sum, s) => sum + s.amount, 0);
  const avgMonthly = totalRevenue / MOCK_SALES.length;

  return (
    <div>
      <h2>Revenue: ${totalRevenue}</h2>
      <p>Avg: ${avgMonthly.toFixed(0)}/mo</p>
      <ul>
        {MOCK_SALES.map(s => <li key={s.month}>{s.month}: ${s.amount}</li>)}
      </ul>
    </div>
  );
};

// src/components/SearchResults.tsx
import React from 'react';
const MOCK_ITEMS = [
  { id: 1, title: 'React Guide', tags: ['react', 'frontend'] },
  { id: 2, title: 'Node Patterns', tags: ['node', 'backend'] }
];
export const SearchResults = ({ query }) => {
  // Derived: filtering logic - should this become server-side?
  const filtered = MOCK_ITEMS.filter(item => 
    item.title.toLowerCase().includes(query.toLowerCase()) ||
    item.tags.some(t => t.includes(query))
  );

  return (
    <div>
      <p>{filtered.length} results for "{query}"</p>
      {filtered.map(item => <div key={item.id}>{item.title}</div>)}
    </div>
  );
};

// src/components/DataTable.tsx
import React from 'react';
const MOCK_COLUMNS = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'email', label: 'Email', sortable: false }
];
const MOCK_ROWS = [
  { name: 'Alice', email: 'alice@example.com' },
  { name: 'Bob', email: 'bob@example.com' }
];
export const DataTable = () => {
  // Derived: combining two mocks - complex binding decision
  const visibleColumns = MOCK_COLUMNS.filter(c => !c.hidden);

  return (
    <table>
      <thead>
        <tr>{visibleColumns.map(c => <th key={c.key}>{c.label}</th>)}</tr>
      </thead>
      <tbody>
        {MOCK_ROWS.map(row => (
          <tr key={row.name}>
            {visibleColumns.map(c => <td key={c.key}>{row[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// --- TODO: State initialization (dangerous to auto-bind) ---
// src/components/UserForm.tsx
import React, { useState } from 'react';
const MOCK_USER_DATA = { name: 'Alice', email: 'alice@example.com', role: 'admin' };
export const UserForm = () => {
  // DANGEROUS: useState with mock as default
  const [formData, setFormData] = useState(MOCK_USER_DATA);
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <form>
      <input name="name" value={formData.name} onChange={handleChange} />
      <input name="email" value={formData.email} onChange={handleChange} />
      <select name="role" value={formData.role} onChange={handleChange}>
        <option>admin</option>
        <option>user</option>
      </select>
    </form>
  );
};

// src/components/ChatWidget.tsx
import React, { useState, useEffect } from 'react';
const MOCK_MESSAGES = [
  { id: 1, text: 'Hello', sender: 'user', timestamp: Date.now() }
];
export const ChatWidget = () => {
  // DANGEROUS: state initialized with mock, then mutated
  const [messages, setMessages] = useState(MOCK_MESSAGES);
  const [input, setInput] = useState('');

  useEffect(() => {
    // DANGEROUS: effect depends on mock-derived state
    if (messages.length > 0) {
      scrollToBottom();
    }
  }, [messages]);

  const sendMessage = () => {
    const newMsg = { id: Date.now(), text: input, sender: 'user', timestamp: Date.now() };
    setMessages([...messages, newMsg]);
  };

  return (
    <div className="chat">
      {messages.map(m => <div key={m.id} className={m.sender}>{m.text}</div>)}
      <input value={input} onChange={e => setInput(e.target.value)} />
      <button onClick={sendMessage}>Send</button>
    </div>
  );
};

// src/components/RealTimeChart.tsx
import React, { useEffect, useRef } from 'react';
const MOCK_CHART_POINTS = [
  { x: 0, y: 10 }, { x: 1, y: 20 }, { x: 2, y: 15 }
];
export const RealTimeChart = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    // DANGEROUS: effect draws mock data imperatively
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, 300, 150);
    ctx.beginPath();
    MOCK_CHART_POINTS.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x * 100, 150 - p.y * 5);
      else ctx.lineTo(p.x * 100, 150 - p.y * 5);
    });
    ctx.stroke();
  }, []);

  return <canvas ref={canvasRef} width={300} height={150} />;
};

// --- TODO: Cross-component prop drilling ---
// src/components/ParentChildFlow.tsx
import React from 'react';
const MOCK_TEAM = [
  { id: 1, name: 'Alice', department: 'Engineering' },
  { id: 2, name: 'Bob', department: 'Design' }
];

const TeamMember = ({ member, onSelect }) => {
  // Child receives prop - if parent mock is bound, this breaks
  return (
    <div onClick={() => onSelect(member)}>
      <h4>{member.name}</h4>
      <span>{member.department}</span>
    </div>
  );
};

export const TeamList = () => {
  const [selected, setSelected] = React.useState(null);

  return (
    <div>
      <h2>Team</h2>
      {MOCK_TEAM.map(m => (
        <TeamMember key={m.id} member={m} onSelect={setSelected} />
      ))}
      {selected && <div>Selected: {selected.name}</div>}
    </div>
  );
};

// --- TODO: Conditional rendering with side effects ---
// src/components/AuthWrapper.tsx
import React from 'react';
const MOCK_AUTH = { isAuthenticated: true, permissions: ['read', 'write'] };
export const AuthWrapper = ({ children, requiredPermission }) => {
  // Conditional that depends on mock - binding changes timing
  if (!MOCK_AUTH.isAuthenticated) {
    return <div>Please log in</div>;
  }

  if (requiredPermission && !MOCK_AUTH.permissions.includes(requiredPermission)) {
    return <div>Access denied: {requiredPermission}</div>;
  }

  return <>{children}</>;
};

// --- HUMAN: Pagination with local state ---
// src/components/PaginatedList.tsx
import React, { useState } from 'react';
const MOCK_ALL_ITEMS = Array.from({ length: 100 }, (_, i) => ({
  id: i + 1,
  title: `Item ${i + 1}`
}));
export const PaginatedList = () => {
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // HUMAN: slice is client-side pagination - should it become server-side?
  const paginatedItems = MOCK_ALL_ITEMS.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(MOCK_ALL_ITEMS.length / pageSize);

  return (
    <div>
      {paginatedItems.map(item => <div key={item.id}>{item.title}</div>)}
      <div>
        <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page} of {totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
};

// --- HUMAN: Form validation with mock defaults ---
// src/components/SignupForm.tsx
import React, { useState } from 'react';
const MOCK_DEFAULTS = { username: '', email: '', acceptTerms: false };
export const SignupForm = () => {
  // HUMAN: mock as form defaults - not state init, but close
  const [values, setValues] = useState({ ...MOCK_DEFAULTS });
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!values.username) newErrors.username = 'Required';
    if (!values.email.includes('@')) newErrors.email = 'Invalid email';
    if (!values.acceptTerms) newErrors.acceptTerms = 'Must accept';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return (
    <form>
      <input value={values.username} onChange={e => setValues({...values, username: e.target.value})} />
      {errors.username && <span>{errors.username}</span>}
      <input value={values.email} onChange={e => setValues({...values, email: e.target.value})} />
      {errors.email && <span>{errors.email}</span>}
      <label>
        <input type="checkbox" checked={values.acceptTerms} onChange={e => setValues({...values, acceptTerms: e.target.checked})} />
        Accept terms
      </label>
      <button onClick={validate}>Submit</button>
    </form>
  );
};

// --- TODO: Complex nested data with imperative logic ---
// src/components/TreeView.tsx
import React, { useEffect, useRef } from 'react';
const MOCK_TREE = {
  id: 'root',
  label: 'Root',
  children: [
    { id: 'c1', label: 'Child 1', children: [
      { id: 'c1-1', label: 'Grandchild 1' }
    ]},
    { id: 'c2', label: 'Child 2', children: [] }
  ]
};
export const TreeView = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    // DANGEROUS: imperative tree rendering from mock
    const renderNode = (node, depth) => {
      const el = document.createElement('div');
      el.style.paddingLeft = `${depth * 20}px`;
      el.textContent = node.label;
      containerRef.current.appendChild(el);
      node.children?.forEach(c => renderNode(c, depth + 1));
    };
    renderNode(MOCK_TREE, 0);
  }, []);

  return <div ref={containerRef} className="tree" />;
};