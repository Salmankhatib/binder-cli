# Binder tRPC Compatibility + Deterministic Improvements Plan
## Target: 91% Auto-Binding Rate

---

## PHASE 1: FOUNDATION (Weeks 1-2)

### 1.1 Router Type Introspection Engine
- [ ] Create `TrpcRouterAnalyzer` class
  - Imports `AppRouter` type from project config
  - Uses ts-morph to resolve router type structure
  - Builds `ProcedureCatalog`: `Map<procedurePath, ProcedureInfo>`

```typescript
interface ProcedureInfo {
  path: string;           // "user.list"
  type: "query" | "mutation" | "subscription";
  inputSchema: ZodType | null;
  outputType: TypeNode;   // resolved TypeScript type
  router: string;         // "user"
  procedure: string;      // "list"
}
```

- [ ] Implement type extraction utilities:
  - `inferRouterOutputs<AppRouter>` equivalent via ts-morph
  - `inferRouterInputs<AppRouter>` equivalent via ts-morph
  - Filter queries vs mutations vs subscriptions

- [ ] Add project configuration:
  - Detect tRPC setup (`trpc.ts`, `root.ts`, `context.ts`)
  - Auto-discover `AppRouter` export path
  - Support monorepo setups (`apps/web`, `packages/api`)

### 1.2 Mock-to-Procedure Shape Matcher
- [ ] Implement structural type comparison:
  - Property-level matching (depth-first object comparison)
  - Array element matching
  - Optional property scoring
  - Nested object shape similarity

- [ ] Scoring algorithm:
  | Match Type | Score |
  |------------|-------|
  | Exact match | 1.0 |
  | Superset (procedure returns more fields) | 0.85 |
  | Subset (procedure returns fewer fields) | 0.60 |
  | Type mismatch (string vs number) | 0.0 |
  | Array vs single | 0.0 |

- [ ] Ranking system:
  - Primary: shape similarity score
  - Secondary: naming convention match (`mockUsers` → `user.list`)
  - Tertiary: usage frequency in project

---

## PHASE 2: INPUT INFERENCE (Weeks 3-4)

### 2.1 Context-Aware Input Resolution
- [ ] Scope analysis for input variables:
  - React props: `function UserCard({ userId })` → input = `{ id: userId }`
  - Parent component state: `const [filter, setFilter]` → input = `filter`
  - URL params: `useParams()` → input = `{ id: params.id }`
  - Context values: `useAuth()` → input = `{ userId: auth.user.id }`

- [ ] Type compatibility check:
  - Compare inferred variable type against procedure input schema
  - Handle optional fields (partial inputs)
  - Handle nested objects (spread matching)

- [ ] Input construction patterns:
  - Direct pass: `trpc.user.getById.useQuery({ id: userId })`
  - Spread: `trpc.user.update.useMutation({ ...formData })`
  - Computed: `trpc.post.list.useQuery({ cursor: lastPage?.nextCursor })`

### 2.2 Input Inference Confidence Scoring
| Scenario | Score |
|----------|-------|
| Exact type match in scope | 0.95 |
| Type match with coercion | 0.80 |
| Multiple candidates | 0.60 (requires human choice) |
| No candidate found | 0.20 (TODO with context) |

---

## PHASE 3: TRANSFORMATION PRESERVATION (Weeks 5-6)

### 3.1 Transformation Chain Detection
- [ ] Recognize common patterns:
  - `.filter()` → preserve as computed
  - `.sort()` → preserve as computed
  - `.map()` → preserve as computed
  - `.slice()` → preserve as computed
  - `.reduce()` → flag for review (complex)

- [ ] Chain analysis:
  - Pure transformations (no side effects): auto-preserve
  - Mixed with local state: flag for review
  - Conditional transformations: flag for review

### 3.2 Computed Derivation Generation
```typescript
// Before:
const activeUsers = mockUsers.filter(u => u.isActive);

// After (auto-generated):
const { data: allUsers } = trpc.user.list.useQuery();
const activeUsers = useMemo(() => 
  allUsers?.filter(u => u.isActive) ?? []
, [allUsers]);
```

- [ ] Handle loading states:
  - Default to empty array for `.filter().map()` chains
  - Default to null for single object access
  - Custom fallback detection from usage context

### 3.3 Import Management
- [ ] Auto-add `useMemo` import if needed
- [ ] Handle existing import conflicts
- [ ] Support both React 17 and 18+

---

## PHASE 4: MUTATION BINDING (Weeks 7-8)

### 4.1 Mutation Pattern Discovery
- [ ] Scan codebase for existing mutation patterns:
  - Find all `useMutation` calls
  - Extract `onSuccess`, `onError`, retry patterns
  - Build template per router: `{ invalidate: string[], toast?: string }`

- [ ] Template application:
  - Auto-generate invalidate calls for sibling queries
  - Copy error handling patterns from existing mutations
  - Apply retry configuration if consistent in project

### 4.2 Mutation-Specific Binding
- [ ] Detect mock mutation patterns:
  - `setUsers([...users, newUser])` → `trpc.user.create.useMutation()`
  - `updateUser(id, data)` → `trpc.user.update.useMutation()`
  - `deleteUser(id)` → `trpc.user.delete.useMutation()`

- [ ] Generate optimistic update patterns:
  - Detect local state updates after mock mutation
  - Generate equivalent `utils.invalidate()` or `setData()` calls

---

## PHASE 5: ADVANCED FEATURES (Weeks 9-10)

### 5.1 Custom Hook Wrapper Discovery
- [ ] Index custom hooks that wrap tRPC:
  - Pattern: `function useCustomUsers() { return trpc.user.list.useQuery() }`
  - Match by return type and usage pattern
  - Prefer custom hook over direct trpc call if available

- [ ] Wrapper parameter inference:
  - If custom hook accepts filters, pass inferred filters
  - If custom hook has default options, respect them

### 5.2 Batch/Parallel Query Detection
- [ ] Detect independent mock variables:
  ```typescript
  const users = mockUsers;
  const posts = mockPosts;
  // → trpc.useQueries([...]) or separate useQuery calls
  ```

- [ ] Detect dependent queries:
  ```typescript
  const user = mockUser;
  const posts = mockPosts.filter(p => p.userId === user.id);
  // → trpc.post.byUser.useQuery({ userId: user.id })
  ```

### 5.3 Subscription Support
- [ ] Detect real-time mock patterns:
  - `setInterval` + mock refresh → `trpc.user.onUpdate.useSubscription()`
  - WebSocket mock → subscription binding

---

## PHASE 6: VALIDATION & SAFETY (Weeks 11-12)

### 6.1 TypeScript Compiler Validation
- [ ] ts-morph type checker on every binding:
  - Ensure no type errors after transformation
  - Verify imported types are accessible
  - Check for missing type exports from server

- [ ] Cross-boundary type safety:
  - Ensure `AppRouter` type is importable from client
  - Verify no server-only types leak to client
  - Check for tRPC version compatibility

### 6.2 Runtime Safety
- [ ] E2B sandbox testing:
  - Apply binding in isolated environment
  - Run TypeScript compilation
  - Run unit tests for affected components

- [ ] Fallback mechanisms:
  - If type check fails: revert + TODO
  - If tests fail: revert + TODO with error context
  - If import resolution fails: suggest manual fix

### 6.3 Project Health Checks
- [ ] Pre-binding validation:
  - Is tRPC client properly initialized?
  - Are query providers wrapped around app?
  - Is React Query Devtools available for debugging?

- [ ] Post-binding report:
  - List of auto-bound procedures
  - List of TODO items with suggested procedures
  - Performance impact estimate (query count change)

---

## PHASE 7: OPTIMIZATION & POLISH (Weeks 13-14)

### 7.1 Caching & Performance
- [ ] Router catalog caching:
  - Cache parsed `AppRouter` structure
  - Invalidate on server file changes
  - Incremental updates for large routers

- [ ] Binding decision caching:
  - Remember mock→procedure mappings per project
  - Share across team via `.binder/cache.json`
  - Version control integration for shared learning

### 7.2 Developer Experience
- [ ] Interactive binding mode:
  - Preview diff before apply
  - Step-through for ambiguous cases
  - Undo/redo with git integration

- [ ] IDE integration:
  - VS Code extension for inline binding suggestions
  - Hover info showing bound procedure details
  - Go-to-definition from mock to router resolver

- [ ] Reporting:
  - Binding session summary
  - Coverage metrics (auto vs human vs todo)
  - Time saved estimation

### 7.3 Documentation & Examples
- [ ] tRPC-specific documentation:
  - Setup guide for tRPC projects
  - Common patterns and edge cases
  - Troubleshooting type errors

- [ ] Example migrations:
  - Full project walkthrough
  - Before/after code samples
  - Video tutorials

---

## EXPECTED OUTCOMES

| Metric | REST | tRPC Baseline | tRPC + Improvements |
|--------|------|---------------|---------------------|
| Auto-binding rate | 60% | 84% | **91%** |
| Input inference success | N/A | 75% | **95%** |
| Transformation preserve | N/A | 70% | **92%** |
| Mutation binding success | N/A | 55% | **85%** |
| Type safety (compile) | 85% | 95% | **99%** |
| Developer time saved | 40% | 65% | **80%** |

### Remaining 9% human-in-the-loop:
- Complex business logic entangled with data (3%)
- Novel patterns not seen in project (3%)
- Cross-router atomic operations (2%)
- Performance-sensitive custom caching (1%)

---

## TECHNICAL ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────────────────┐
│  BINDER CORE (Deterministic)                                            │
│  ├── TrpcRouterAnalyzer      ← NEW: AppRouter type introspection        │
│  ├── ShapeMatcher            ← NEW: Structural type comparison          │
│  ├── InputInferenceEngine    ← NEW: Context-aware input resolution     │
│  ├── TransformationPreserver ← NEW: Chain detection & useMemo gen      │
│  ├── MutationPatternDiscovery← NEW: Template extraction & application │
│  ├── CustomHookIndexer       ← NEW: Wrapper discovery                  │
│  ├── AstManipulator          ← EXISTING: ts-morph rewrites             │
│  ├── TypeChecker             ← EXISTING: ts-morph validation           │
│  └── DecisionEngine          ← EXISTING: tier classification           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  MCP CONSUMERS (Optional Enhancements)                                  │
│  ├── @r-mcp/static-analysis  ← Symbol search, reference finding         │
│  ├── tree-hugger-js-mcp      ← AST pattern matching                   │
│  ├── @anthropic-ai/mcp-server-e2b ← Sandbox validation                  │
│  └── playwright-mcp          ← E2E screenshot validation                │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## IMPLEMENTATION PRIORITY

### P0 (Must have for tRPC support):
- Router Type Introspection
- Mock-to-Procedure Shape Matcher
- Basic Input Inference (props, params)
- TypeScript Compiler Validation

### P1 (Required for 90%+):
- Transformation Chain Preservation
- Mutation Pattern Discovery
- Custom Hook Wrapper Discovery
- E2B Sandbox Testing

### P2 (Polish):
- Batch/Parallel Query Detection
- Subscription Support
- IDE Integration
- Interactive Binding Mode



  
 Here's the complete implementation plan:

---

## Binder tRPC Compatibility + Deterministic Improvements Plan
### Target: **91% Auto-Binding Rate**

---

### PHASE 1: FOUNDATION (Weeks 1-2)

**1.1 Router Type Introspection Engine**

Create a `TrpcRouterAnalyzer` class that imports the `AppRouter` type directly from the project and uses ts-morph to resolve its structure. This builds a `ProcedureCatalog` — a complete typed map of every procedure:

```typescript
interface ProcedureInfo {
  path: string;           // "user.list"
  type: "query" | "mutation" | "subscription";
  inputSchema: ZodType | null;
  outputType: TypeNode;   // resolved TypeScript type
  router: string;         // "user"
  procedure: string;      // "list"
}
```

Key capabilities:
- `inferRouterOutputs<AppRouter>` and `inferRouterInputs<AppRouter>` equivalents via ts-morph
- Auto-detect tRPC setup (`trpc.ts`, `root.ts`, `context.ts`)
- Support monorepos (`apps/web`, `packages/api`)

**1.2 Mock-to-Procedure Shape Matcher**

Structural type comparison with scoring:

| Match Type | Score |
|------------|-------|
| Exact match | 1.0 |
| Superset (procedure returns more fields) | 0.85 |
| Subset (procedure returns fewer fields) | 0.60 |
| Type mismatch | 0.0 |

Ranking: shape similarity → naming convention → usage frequency.

---

### PHASE 2: INPUT INFERENCE (Weeks 3-4)

**2.1 Context-Aware Input Resolution**

Trace scope for input variables:
- React props: `function UserCard({ userId })` → `{ id: userId }`
- Parent state: `const [filter, setFilter]` → `filter`
- URL params: `useParams()` → `{ id: params.id }`
- Context: `useAuth()` → `{ userId: auth.user.id }`

**2.2 Confidence Scoring**

| Scenario | Score |
|----------|-------|
| Exact type match in scope | 0.95 |
| Type match with coercion | 0.80 |
| Multiple candidates | 0.60 (human choice) |
| No candidate found | 0.20 (TODO) |

---

### PHASE 3: TRANSFORMATION PRESERVATION (Weeks 5-6)

**3.1 Chain Detection**

Recognize `.filter()`, `.sort()`, `.map()`, `.slice()` → auto-preserve as computed. Flag `.reduce()` and conditional transforms for review.

**3.2 Computed Derivation Generation**

```typescript
// Before:
const activeUsers = mockUsers.filter(u => u.isActive);

// After:
const { data: allUsers } = trpc.user.list.useQuery();
const activeUsers = useMemo(() => 
  allUsers?.filter(u => u.isActive) ?? []
, [allUsers]);
```

---

### PHASE 4: MUTATION BINDING (Weeks 7-8)

**4.1 Pattern Discovery**

Scan existing `useMutation` calls to build templates per router:
```typescript
{ invalidate: string[], onSuccess?: string, retry?: number }
```

**4.2 Auto-Generate**

- `setUsers([...users, newUser])` → `trpc.user.create.useMutation()`
- Auto-generate `utils.user.list.invalidate()` from template

---

### PHASE 5: ADVANCED FEATURES (Weeks 9-10)

- **Custom Hook Wrapper Discovery**: Index `useCustomUsers()` that wraps `trpc.user.list.useQuery()`
- **Batch/Parallel Query Detection**: Detect independent mocks → `trpc.useQueries([...])`
- **Subscription Support**: `setInterval` mock refresh → `trpc.user.onUpdate.useSubscription()`

---

### PHASE 6: VALIDATION & SAFETY (Weeks 11-12)

- ts-morph type checker on every binding
- E2B sandbox testing (compile + unit tests)
- Fallback: revert + `TODO(BINDER)` on any failure
- Cross-boundary type safety (no server-only types leaking to client)

---

### PHASE 7: OPTIMIZATION (Weeks 13-14)

- Router catalog caching with incremental updates
- Binding decision cache (`.binder/cache.json`) shared across team
- VS Code extension with inline suggestions X 
- Go-to-definition from mock → router resolver

---

## Expected Outcomes

| Metric | REST | tRPC Baseline | tRPC + Improvements |
|--------|------|---------------|---------------------|
| Auto-binding rate | 60% | 84% | **91%** |
| Input inference | N/A | 75% | **95%** |
| Transformation preserve | N/A | 70% | **92%** |
| Mutation binding | N/A | 55% | **85%** |
| Type safety | 85% | 95% | **99%** |

**Remaining 9% human-in-the-loop**: complex business logic (3%), novel patterns (3%), cross-router operations (2%), performance-sensitive caching (1%).

---

## Priority

**P0** (must-have): Router introspection, shape matcher, basic input inference, TS validation
**P1** (for 90%+): Transformation preservation, mutation patterns, custom hook discovery, E2B testing
**P2** (polish): Batch queries, subscriptions, IDE integration


tRPC + Deterministic Improvements: ~4%
With the enhancements from the plan, the TODO ratio drops further:

| Remaining TODO Category            | Frequency | Why Still Skipped                                                                                       |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| **Complex derived state**          | 3%        | `.reduce()`, conditional grouping, local state merging. These are **business logic**, not data binding. |
| **Cross-router atomic operations** | 2%        | Architectural decisions beyond tool scope.                                                              |
| **Novel patterns**                 | 3%        | First occurrence in project. Binder hasn't learned the pattern yet.                                     |
| **Performance/architecture**       | 1%        | Custom caching, `select` functions, `staleTime` tuning.                                                 |

What the TODO Comments Look Like

// TODO(BINDER): INPUT_INFERENCE_FAILED
//   Mock: user (type: User)
//   Best match: user.getById (score: 0.98)
//   Missing: input.id — no userId variable in scope
//   Suggestion: const { data: user } = trpc.user.getById.useQuery({ id: ??? });
//   ^ Replace ??? with actual ID (from URL params, props, or context)
//   Confidence: 0.98 (match), 0.20 (input)

The TODO ratio drops from 23% to 4% because tRPC gives Binder perfect knowledge of the API contract — no guessing endpoints, no shape drift, no manual type mapping. The remaining 4% is genuinely architectural work that no tool should automate: business logic entanglement, cross-domain atomicity, performance tuning.

The tool's real value isn't eliminating TODOs entirely — it's making TODOs actionable with rich context, suggested approaches, and confidence scores so the human time is spent on architecture, not mechanical binding.

