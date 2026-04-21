import express from 'express';

const app = express();
app.use(express.json());

let tasks = [
  { id: 1, title: 'Setup Node Backend', description: 'Initialize express app', status: 'done', assignedTo: 'Alice' },
  { id: 2, title: 'Create React Pages', description: 'Dashboard and Tasks', status: 'todo', assignedTo: 'Bob' },
];

// GET /tasks
app.get('/tasks', (req, res) => res.json(tasks));

// POST /tasks
app.post('/tasks', (req, res) => {
  const task = { ...req.body, id: tasks.length + 1 };
  tasks.push(task);
  res.status(201).json(task);
});

// DELETE /tasks/:id
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  tasks = tasks.filter(t => t.id !== id);
  res.json({ message: 'Deleted' });
});

// GET /stats
app.get('/stats', (req, res) => {
  const done = tasks.filter(t => t.status === 'done').length;
  res.json({
    totalTasks: tasks.length,
    completedTasks: done,
    pendingTasks: tasks.length - done,
    teamMembers: 4
  });
});

// OpenAPI Spec endpoint for Binder to consume
app.get('/swagger.json', (req, res) => {
  res.json({
    openapi: '3.0.0',
    info: { title: 'Team App API', version: '1.0.0' },
    paths: {
      '/tasks': {
        get: { responses: { '200': { description: 'OK', content: { 'application/json': { schema: { type: 'array', items: { $ref: '#/components/schemas/Task' } } } } } } },
        post: { requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } }, responses: { '201': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Task' } } } } } }
      },
      '/tasks/{id}': {
        delete: { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'OK' } } }
      },
      '/stats': {
        get: { responses: { '200': { content: { 'application/json': { schema: { $ref: '#/components/schemas/Stats' } } } } } }
      }
    },
    components: {
      schemas: {
        Task: { type: 'object', properties: { id: { type: 'integer' }, title: { type: 'string' }, description: { type: 'string' }, status: { type: 'string' }, assignedTo: { type: 'string' } } },
        Stats: { type: 'object', properties: { totalTasks: { type: 'integer' }, completedTasks: { type: 'integer' }, pendingTasks: { type: 'integer' }, teamMembers: { type: 'integer' } } }
      }
    }
  });
});

app.listen(8001, () => console.log('Team App Node Backend on port 8001'));
