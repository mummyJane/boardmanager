import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const deviceManagerRoot = path.join(projectRoot, "device-manager");
const dataRoot = path.join(deviceManagerRoot, "data");
const profilesRoot = path.join(deviceManagerRoot, "profiles");
const schemaRoot = path.join(deviceManagerRoot, "schema");

async function loadJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function loadJsonFiles(rootDir) {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await loadJsonFiles(fullPath));
    } else if (entry.name.endsWith(".json")) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

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

async function validateFileAgainstSchema(filePath, schemaPath, errors) {
  const [schema, data] = await Promise.all([loadJson(schemaPath), loadJson(filePath)]);
  validateValue(schema, data, path.relative(projectRoot, filePath), errors);
}

async function main() {
  const errors = [];
  const validations = [
    {
      file: path.join(dataRoot, "inventory.json"),
      schema: path.join(schemaRoot, "device-inventory.schema.json"),
    },
    {
      file: path.join(dataRoot, "unit-history.json"),
      schema: path.join(schemaRoot, "unit-history.schema.json"),
    },
    {
      file: path.join(dataRoot, "unit-annotations.json"),
      schema: path.join(schemaRoot, "unit-annotations.schema.json"),
    },
    {
      file: path.join(dataRoot, "unit-overrides.json"),
      schema: path.join(schemaRoot, "unit-overrides.schema.json"),
    },
    {
      file: path.join(dataRoot, "discovery-runs.json"),
      schema: path.join(schemaRoot, "discovery-runs.schema.json"),
    },
  ];

  for (const validation of validations) {
    await validateFileAgainstSchema(validation.file, validation.schema, errors);
  }

  const profileFiles = await loadJsonFiles(profilesRoot);
  const profileSchemaPath = path.join(schemaRoot, "family-profile.schema.json");
  for (const file of profileFiles) {
    await validateFileAgainstSchema(file, profileSchemaPath, errors);
  }

  if (errors.length > 0) {
    for (const error of errors) {
      console.error(`Validation error: ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log(`Validated device-manager data: 5 data files, conflict-aware history, and ${profileFiles.length} profile files.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
