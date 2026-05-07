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
  const zodSchemaName = `${hookName.replace(/^use/, '').charAt(0).toLowerCase() + hookName.replace(/^use/, '').slice(1)}Schema`;

  const zodSchema = generateZodSchema(bodySchema);
  const typeInference = `export type ${componentName}Input = z.infer<typeof ${zodSchemaName}>;`;

  let code = pattern.template
    .replace(/{{hookName}}/g, hookName)
    .replace(/{{componentName}}/g, componentName)
    .replace(/{{zodSchemaName}}/g, zodSchemaName)
    .replace(/{{zodSchema}}/g, zodSchema)
    .replace(/{{typeInference}}/g, typeInference)
    .replace(/{{fields}}/g, fieldsHtml);

  return code;
}

export function generateZodSchema(bodySchema: any): string {
  if (!bodySchema || !bodySchema.properties) return 'z.object({})';

  const props = Object.keys(bodySchema.properties).map(key => {
    const prop = bodySchema.properties[key];
    let zodType = 'z.string()';
    
    if (prop.type === 'number') zodType = 'z.number()';
    if (prop.type === 'boolean') zodType = 'z.boolean()';
    if (prop.format === 'email') zodType = 'z.string().email()';
    
    const isRequired = bodySchema.required?.includes(key);
    return `  ${key}: ${zodType}${isRequired ? '' : '.optional()'}`;
  }).join(',\n');

  return `z.object({\n${props}\n})`;
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
