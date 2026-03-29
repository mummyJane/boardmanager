import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const contractsRoot = path.join(projectRoot, "job-manager", "contracts");
const schemaPath = path.join(projectRoot, "job-manager", "schema", "validation-contract.schema.json");

function typeMatches(value, expectedType) {
  if (expectedType === "null") return value === null;
  if (expectedType === "array") return Array.isArray(value);
  if (expectedType === "integer") return Number.isInteger(value);
  if (expectedType === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  return typeof value === expectedType;
}

function describeType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validateValue(schema, value, context, errors) {
  if (!schema || typeof schema !== "object") return;

  if (schema.type) {
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];
    const matches = expectedTypes.some((expectedType) => typeMatches(value, expectedType));
    if (!matches) {
      errors.push(`${context}: expected type ${expectedTypes.join("|")}, got ${describeType(value)}`);
      return;
    }
  }

  if (schema.required && value && typeof value === "object" && !Array.isArray(value)) {
    for (const key of schema.required) {
      if (!(key in value)) {
        errors.push(`${context}: missing required property '${key}'`);
      }
    }
  }

  if (schema.additionalProperties === false && value && typeof value === "object" && !Array.isArray(value) && schema.properties) {
    const allowed = new Set(Object.keys(schema.properties));
    for (const key of Object.keys(value)) {
      if (!allowed.has(key)) {
        errors.push(`${context}: unexpected property '${key}'`);
      }
    }
  }

  if (schema.minimum !== undefined && typeof value === "number" && value < schema.minimum) {
    errors.push(`${context}: value ${value} is less than minimum ${schema.minimum}`);
  }

  if (schema.properties && value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, propertySchema] of Object.entries(schema.properties)) {
      if (key in value) {
        validateValue(propertySchema, value[key], `${context}.${key}`, errors);
      }
    }
  }

  if (schema.items && Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      validateValue(schema.items, item, `${context}[${index}]`, errors);
    }
  }
}

async function main() {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  const entries = await readdir(contractsRoot, { withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith('.json')).map((entry) => entry.name).sort();
  const errors = [];

  for (const file of files) {
    const filePath = path.join(contractsRoot, file);
    const data = JSON.parse(await readFile(filePath, "utf8"));
    validateValue(schema, data, path.relative(projectRoot, filePath), errors);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Validation error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated Stage 3 validation contracts: ${files.length} contract files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
