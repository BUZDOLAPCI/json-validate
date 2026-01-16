import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createSuccessResponse, createErrorResponse } from '../types.js';
// Create Ajv instance with useDefaults for repair
const ajv = new Ajv.default({
    allErrors: true,
    verbose: true,
    strict: false,
    validateFormats: true,
    useDefaults: true,
    coerceTypes: false // We'll handle coercion manually for tracking
});
addFormats.default(ajv);
/**
 * Attempt to parse malformed JSON string
 */
function tryParseJson(text) {
    const errors = [];
    // First try standard parse
    try {
        return { parsed: JSON.parse(text), errors: [] };
    }
    catch {
        errors.push('Standard JSON parse failed, attempting repairs...');
    }
    let repaired = text;
    // Fix 1: Remove trailing commas in arrays and objects
    repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
    // Fix 2: Replace single quotes with double quotes (but not inside strings)
    repaired = repaired.replace(/'/g, '"');
    // Fix 3: Add quotes to unquoted keys
    repaired = repaired.replace(/(\{|\,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
    // Fix 4: Remove comments (// and /* */)
    repaired = repaired.replace(/\/\/[^\n]*/g, '');
    repaired = repaired.replace(/\/\*[\s\S]*?\*\//g, '');
    // Fix 5: Handle undefined and NaN
    repaired = repaired.replace(/:\s*undefined\b/g, ': null');
    repaired = repaired.replace(/:\s*NaN\b/g, ': null');
    // Fix 6: Handle unquoted string values that look like keywords
    // Be careful not to break true/false/null
    try {
        const parsed = JSON.parse(repaired);
        errors.push('JSON repaired successfully with syntax fixes');
        return { parsed, errors };
    }
    catch {
        errors.push('Could not repair JSON syntax');
    }
    return { parsed: undefined, errors };
}
/**
 * Get value at JSON path
 */
function getAtPath(obj, path) {
    if (path === '' || path === '/')
        return obj;
    const parts = path.split('/').filter(p => p !== '');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined)
            return undefined;
        if (typeof current === 'object') {
            current = current[part];
        }
        else {
            return undefined;
        }
    }
    return current;
}
/**
 * Set value at JSON path
 */
function setAtPath(obj, path, value) {
    if (path === '' || path === '/')
        return;
    const parts = path.split('/').filter(p => p !== '');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current === null || current === undefined || typeof current !== 'object')
            return;
        current = current[part];
    }
    if (current !== null && current !== undefined && typeof current === 'object') {
        const lastPart = parts[parts.length - 1];
        current[lastPart] = value;
    }
}
/**
 * Delete value at JSON path
 */
function deleteAtPath(obj, path) {
    if (path === '' || path === '/')
        return false;
    const parts = path.split('/').filter(p => p !== '');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (current === null || current === undefined || typeof current !== 'object')
            return false;
        current = current[part];
    }
    if (current !== null && current !== undefined && typeof current === 'object') {
        const lastPart = parts[parts.length - 1];
        if (lastPart in current) {
            delete current[lastPart];
            return true;
        }
    }
    return false;
}
/**
 * Deep clone an object
 */
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
/**
 * Try to coerce a value to match a schema type
 */
function tryCoerce(value, targetType) {
    if (value === null || value === undefined) {
        return { coerced: value, success: false };
    }
    switch (targetType) {
        case 'string':
            if (typeof value !== 'string') {
                return { coerced: String(value), success: true };
            }
            break;
        case 'number':
        case 'integer':
            if (typeof value === 'string') {
                const num = Number(value);
                if (!isNaN(num)) {
                    if (targetType === 'integer') {
                        return { coerced: Math.round(num), success: true };
                    }
                    return { coerced: num, success: true };
                }
            }
            if (typeof value === 'boolean') {
                return { coerced: value ? 1 : 0, success: true };
            }
            break;
        case 'boolean':
            if (typeof value === 'string') {
                if (value.toLowerCase() === 'true' || value === '1') {
                    return { coerced: true, success: true };
                }
                if (value.toLowerCase() === 'false' || value === '0' || value === '') {
                    return { coerced: false, success: true };
                }
            }
            if (typeof value === 'number') {
                return { coerced: value !== 0, success: true };
            }
            break;
        case 'array':
            if (!Array.isArray(value) && value !== null && value !== undefined) {
                return { coerced: [value], success: true };
            }
            break;
        case 'null':
            if (value === '' || value === 'null' || value === undefined) {
                return { coerced: null, success: true };
            }
            break;
    }
    return { coerced: value, success: false };
}
/**
 * Get schema at path for property lookup
 */
function getSchemaAtPath(schema, path) {
    if (path === '' || path === '/')
        return schema;
    const parts = path.split('/').filter(p => p !== '');
    let current = schema;
    for (const part of parts) {
        if (current.type === 'object' && current.properties) {
            const props = current.properties;
            if (props[part]) {
                current = props[part];
            }
            else {
                return undefined;
            }
        }
        else if (current.type === 'array' && current.items) {
            current = current.items;
        }
        else {
            return undefined;
        }
    }
    return current;
}
/**
 * Recursively remove additional properties not in schema
 */
function removeAdditionalProperties(obj, schema, path, changes) {
    if (obj === null || obj === undefined || typeof obj !== 'object')
        return;
    if (Array.isArray(obj)) {
        const itemSchema = schema.items;
        if (itemSchema) {
            obj.forEach((item, index) => {
                removeAdditionalProperties(item, itemSchema, `${path}/${index}`, changes);
            });
        }
        return;
    }
    // Handle object
    if (schema.type === 'object' || schema.properties) {
        const allowAdditional = schema.additionalProperties !== false;
        const properties = (schema.properties || {});
        const patternProps = schema.patternProperties;
        const objRecord = obj;
        const keysToRemove = [];
        for (const key of Object.keys(objRecord)) {
            const isKnownProperty = key in properties;
            const matchesPattern = patternProps && Object.keys(patternProps).some(pattern => new RegExp(pattern).test(key));
            if (!allowAdditional && !isKnownProperty && !matchesPattern) {
                keysToRemove.push(key);
            }
            else if (properties[key]) {
                // Recursively check nested objects
                removeAdditionalProperties(objRecord[key], properties[key], `${path}/${key}`, changes);
            }
        }
        for (const key of keysToRemove) {
            const removedValue = objRecord[key];
            delete objRecord[key];
            changes.push({
                path: `${path}/${key}`,
                action: 'removed',
                from: removedValue,
                reason: 'Property not allowed by schema (additionalProperties: false)'
            });
        }
    }
}
/**
 * Apply schema defaults recursively
 */
function applyDefaults(obj, schema, path, changes) {
    if (schema.type === 'object' || schema.properties) {
        const properties = (schema.properties || {});
        const required = (schema.required || []);
        if (obj === null || obj === undefined || typeof obj !== 'object' || Array.isArray(obj)) {
            if (schema.default !== undefined) {
                changes.push({
                    path,
                    action: 'defaulted',
                    from: obj,
                    to: schema.default,
                    reason: 'Applied schema default for missing object'
                });
                return deepClone(schema.default);
            }
            // Create empty object if required
            obj = {};
        }
        const objRecord = obj;
        for (const [propName, propSchema] of Object.entries(properties)) {
            const propPath = path ? `${path}/${propName}` : `/${propName}`;
            if (!(propName in objRecord)) {
                // Apply default if available
                if (propSchema.default !== undefined) {
                    objRecord[propName] = deepClone(propSchema.default);
                    changes.push({
                        path: propPath,
                        action: 'defaulted',
                        to: propSchema.default,
                        reason: 'Applied schema default value'
                    });
                }
                else if (required.includes(propName)) {
                    // Only add required fields if schema provides a clear default type
                    if (propSchema.type === 'object') {
                        objRecord[propName] = {};
                        changes.push({
                            path: propPath,
                            action: 'added',
                            to: {},
                            reason: 'Added required object property'
                        });
                    }
                    else if (propSchema.type === 'array') {
                        objRecord[propName] = [];
                        changes.push({
                            path: propPath,
                            action: 'added',
                            to: [],
                            reason: 'Added required array property'
                        });
                    }
                    // Note: We don't invent values for required string/number/boolean fields
                    // as per the conservative repair principle
                }
            }
            else {
                // Recursively apply defaults to nested objects
                objRecord[propName] = applyDefaults(objRecord[propName], propSchema, propPath, changes);
            }
        }
        return obj;
    }
    if (schema.type === 'array' && schema.items) {
        if (!Array.isArray(obj)) {
            if (schema.default !== undefined) {
                changes.push({
                    path,
                    action: 'defaulted',
                    from: obj,
                    to: schema.default,
                    reason: 'Applied schema default for non-array value'
                });
                return deepClone(schema.default);
            }
            return obj;
        }
        const itemSchema = schema.items;
        return obj.map((item, index) => applyDefaults(item, itemSchema, `${path}/${index}`, changes));
    }
    // Handle primitive with default
    if (obj === undefined && schema.default !== undefined) {
        changes.push({
            path,
            action: 'defaulted',
            to: schema.default,
            reason: 'Applied schema default value'
        });
        return schema.default;
    }
    return obj;
}
/**
 * Attempt type coercion based on schema
 */
function applyTypeCoercion(obj, schema, path, changes) {
    const schemaType = schema.type;
    if (!schemaType)
        return obj;
    const types = Array.isArray(schemaType) ? schemaType : [schemaType];
    // Check if current type matches
    const currentType = Array.isArray(obj) ? 'array' : obj === null ? 'null' : typeof obj;
    if (types.includes(currentType)) {
        // Type matches, check nested
        if (currentType === 'object' && schema.properties && obj !== null) {
            const properties = schema.properties;
            const objRecord = obj;
            for (const [propName, propSchema] of Object.entries(properties)) {
                if (propName in objRecord) {
                    objRecord[propName] = applyTypeCoercion(objRecord[propName], propSchema, `${path}/${propName}`, changes);
                }
            }
        }
        else if (currentType === 'array' && schema.items && Array.isArray(obj)) {
            const itemSchema = schema.items;
            return obj.map((item, index) => applyTypeCoercion(item, itemSchema, `${path}/${index}`, changes));
        }
        return obj;
    }
    // Try coercion for each allowed type
    for (const targetType of types) {
        const { coerced, success } = tryCoerce(obj, targetType);
        if (success) {
            changes.push({
                path,
                action: 'coerced',
                from: obj,
                to: coerced,
                reason: `Coerced ${typeof obj} to ${targetType}`
            });
            return coerced;
        }
    }
    return obj;
}
/**
 * Repair JSON to match schema
 */
export function repairJson(input) {
    try {
        // Validate schema input
        if (!input.schema || typeof input.schema !== 'object') {
            return createErrorResponse('INVALID_INPUT', 'Schema must be a valid JSON Schema object', { received: typeof input.schema });
        }
        const changes = [];
        const parseErrors = [];
        let instance;
        // Handle string input (potentially malformed JSON)
        if (typeof input.instance_or_text === 'string') {
            const { parsed, errors } = tryParseJson(input.instance_or_text);
            parseErrors.push(...errors);
            if (parsed === undefined) {
                return createErrorResponse('PARSE_ERROR', 'Could not parse or repair JSON string', { parseErrors });
            }
            instance = parsed;
        }
        else {
            instance = deepClone(input.instance_or_text);
        }
        // Apply repairs in order
        // 1. Remove additional properties if schema disallows them
        removeAdditionalProperties(instance, input.schema, '', changes);
        // 2. Apply type coercion
        instance = applyTypeCoercion(instance, input.schema, '', changes);
        // 3. Apply schema defaults
        instance = applyDefaults(instance, input.schema, '', changes);
        // Validate the repaired result
        let validate;
        try {
            validate = ajv.compile(input.schema);
        }
        catch (err) {
            return createErrorResponse('INVALID_INPUT', `Invalid JSON Schema: ${err instanceof Error ? err.message : String(err)}`, { schemaError: true });
        }
        const valid = validate(instance);
        const warnings = [];
        if (!valid && validate.errors) {
            warnings.push('Repaired JSON still has validation errors - some issues could not be automatically fixed');
        }
        return createSuccessResponse({
            repaired: instance,
            changes,
            parseErrors: parseErrors.length > 0 ? parseErrors : undefined
        }, {
            source: 'json-validate',
            warnings
        });
    }
    catch (err) {
        return createErrorResponse('INTERNAL_ERROR', `Repair failed: ${err instanceof Error ? err.message : String(err)}`, { error: err instanceof Error ? err.stack : undefined });
    }
}
//# sourceMappingURL=repair.js.map