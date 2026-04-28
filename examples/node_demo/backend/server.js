import express from 'express';
const app = express();
const port = 8002;

app.use(express.json());

// In-memory data
let projects = [
  { id: 1, name: "Binder Engine", status: "active", version: "0.1.0" },
  { id: 2, name: "Neural Connect", status: "pending", version: "1.2.5" },
];

let profile = {
  username: "AI_Architect",
  level: "Senior",
  lastLogin: new Date().toISOString()
};

// Endpoints
app.get('/projects', (req, res) => res.json(projects));
app.get('/profile', (req, res) => res.json(profile));
app.delete('/projects/:id', (req, res) => {
    const id = parseInt(req.params.id);
    projects = projects.filter(p => p.id !== id);
    res.json({ success: true });
});

// OpenAPI Spec
app.get('/swagger.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Node Demo API', version: '1.0.0' },
    paths: {
      '/projects': {
        get: { responses: { '200': { content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Project' } } } } } } }
      },
      '/projects/{id}': {
        delete: { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } }
      },
      '/profile': {
        get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Profile' } } } } } }
      }
    },
    components: {
      schemas: {
        Project: { type: 'object', properties: { id: { type: 'integer' }, name: { type: 'string' }, status: { type: 'string' }, version: { type: 'string' } } },
        Profile: { type: 'object', properties: { username: { type: 'string' }, level: { type: 'string' }, lastLogin: { type: 'string' } } }
      }
    }
  });
});

app.listen(port, () => console.log(`🚀 Node Demo Backend running at http://localhost:${port}`));
