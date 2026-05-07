import { describe, it, expect } from 'vitest';
import { generateComponent } from '../src/generate/componentGenerator.js';

describe('Scaffold Component Generation', () => {
  const mockSchema = {
    paths: {
      '/users': {
        post: {
          operationId: 'createUser',
          requestBody: {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    username: { type: 'string' },
                    age: { type: 'number' },
                    isAdmin: { type: 'boolean' }
                  }
                }
              }
            }
          }
        }
      }
    }
  };

  const mockPattern = {
    name: 'Test Pattern',
    template: 'HOOK: {{hookName}}, COMPONENT: {{componentName}}, FIELDS: {{fields}}'
  };

  it('should generate a form with correct fields from schema', () => {
    const code = generateComponent(mockSchema, '/users', 'post', mockPattern);
    
    expect(code).toContain('HOOK: useCreateUser');
    expect(code).toContain('COMPONENT: CreateUserForm');
    expect(code).toContain('register(\'username\'');
    expect(code).toContain('type="text"');
    expect(code).toContain('register(\'age\'');
    expect(code).toContain('type="number"');
  });
});
