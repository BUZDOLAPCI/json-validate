import Ajv from 'ajv';
import { type ResponseEnvelope, type ValidationResult, type ValidateJsonInput } from '../types.js';
declare const ajv: Ajv.Ajv;
/**
 * Validate a JSON instance against a JSON Schema
 */
export declare function validateJson(input: ValidateJsonInput): ResponseEnvelope<ValidationResult>;
/**
 * Export the Ajv instance for use in other tools
 */
export { ajv };
//# sourceMappingURL=validate.d.ts.map