/**
 * AJV-based runtime validator for LLM output JSON schemas.
 */
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import {
  characterActionSchema,
  worldAgentResultSchema,
  novelizerChapterSchema,
} from './json-schemas';

const ajv = new Ajv({ allErrors: true, strict: false });
// Format support is optional; if ajv-formats not installed, format checks are no-ops
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  addFormats(ajv);
} catch {
  // ignore
}

const validators = {
  character: ajv.compile(characterActionSchema as object) as ValidateFunction,
  worldAgent: ajv.compile(worldAgentResultSchema as object) as ValidateFunction,
  novelizer: ajv.compile(novelizerChapterSchema as object) as ValidateFunction,
};

export type SchemaName = keyof typeof validators;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export function validateLLMOutput(name: SchemaName, data: unknown): ValidationResult {
  const validator = validators[name];
  const ok = validator(data) as boolean;
  if (ok) return { ok: true, errors: [] };
  const errors = (validator.errors ?? []).map(
    (e) => `${e.instancePath || '/'} ${e.message ?? ''}`,
  );
  return { ok: false, errors };
}
