import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { logger } from '../utils/logger.js';
import { Pattern } from './patternLoader.js';

/**
 * componentGenerator maps OpenAPI schemas to React components.
 */
export function generateComponent(schema: any, path: string, method: string, pattern: Pattern): string {
  const operation = schema.paths[path][method];
  const bodySchema = getRequestBodySchema(schema, operation);
  
  let fieldsHtml = '';
  if (bodySchema && bodySchema.properties) {
    fieldsHtml = Object.keys(bodySchema.properties).map(propName => {
      const prop = bodySchema.properties[propName];
      return generateField(propName, prop);
    }).join('\n      ');
  }

  const hookName = operation.operationId ? `use${operation.operationId.charAt(0).toUpperCase() + operation.operationId.slice(1)}` : 'useUnknownMutation';
  const componentName = `${hookName.replace(/^use/, '')}Form`;

  let code = pattern.template
    .replace(/{{hookName}}/g, hookName)
    .replace(/{{componentName}}/g, componentName)
    .replace(/{{fields}}/g, fieldsHtml);

  return code;
}

function generateField(name: string, prop: any): string {
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  const type = prop.type === 'number' ? 'number' : 'text';
  
  return `
      <div>
        <label className="block text-sm font-medium text-gray-700">${label}</label>
        <input 
          {...register('${name}', { required: true })} 
          type="${type}" 
          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        />
        {errors.${name} && <span className="text-xs text-red-600">This field is required</span>}
      </div>`;
}

function getRequestBodySchema(schema: any, operation: any): any {
  const body = operation.requestBody;
  if (!body) return null;

  let content = body.content?.['application/json']?.schema;
  if (!content) return null;

  if (content.$ref) {
    const refPath = content.$ref.replace('#/', '').split('/');
    let current = schema;
    for (const segment of refPath) {
      current = current[segment];
    }
    return current;
  }

  return content;
}
