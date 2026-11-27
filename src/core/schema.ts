import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import formatsModule from "ajv-formats";

const schemaNames = [
  "agent-card",
  "assignment",
  "board",
  "bundle",
  "finding",
  "interview",
  "inventory",
  "lock",
  "manifest",
  "manifest-local",
  "pack",
  "proof-card",
  "spec-front-matter",
  "tenet-yaml",
  "test-report",
] as const;

export type SchemaName = (typeof schemaNames)[number];

export type SchemaError = {
  pointer: string;
  keyword: string;
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  errors: SchemaError[];
};

type JsonSchema = {
  $defs?: Record<string, JsonSchema>;
  $ref?: string;
  additionalProperties?: boolean | JsonSchema;
  allOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  const?: unknown;
  enum?: unknown[];
  items?: JsonSchema;
  oneOf?: JsonSchema[];
  patternProperties?: Record<string, JsonSchema>;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  type?: string | string[];
};

const schemaRoot = fileURLToPath(new URL("../../kit/schemas/", import.meta.url));
const typeOutput = fileURLToPath(new URL("../types/generated.ts", import.meta.url));
const ajv = new Ajv2020({ allErrors: true, strict: true });
const addFormats = formatsModule as unknown as (instance: Ajv2020) => Ajv2020;
addFormats(ajv);

const validators = new Map<SchemaName, ValidateFunction>();
for (const name of schemaNames) {
  const schema = JSON.parse(readFileSync(path.join(schemaRoot, `${name}.json`), "utf8")) as JsonSchema;
  validators.set(name, ajv.compile(schema));
}

export function validate(name: SchemaName, data: unknown, options: { propertyPointers?: boolean } = {}): ValidationResult {
  const validator = validators.get(name);
  if (!validator) throw new RangeError(`Unknown schema: ${name}`);
  const ok = validator(data);
  if (ok) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: (validator.errors ?? []).map((error) => {
      const property: unknown = error.params.missingProperty ?? error.params.additionalProperty;
      const suffix = options.propertyPointers && typeof property === "string"
        ? "/" + property.replaceAll("~", "~0").replaceAll("/", "~1") : "";
      return {
        pointer: error.instancePath + suffix,
        keyword: error.keyword,
        message: error.message ?? "Validation failed",
      };
    }),
  };
}

function pascalCase(value: string): string {
  return value
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join("");
}

function propertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function literal(value: unknown): string {
  if (value === undefined) return "undefined";
  return JSON.stringify(value);
}

function schemaType(schema: JsonSchema, root: JsonSchema): string {
  if (schema.const !== undefined) return literal(schema.const);
  if (schema.enum) return [...new Set(schema.enum.map(literal))].join(" | ");
  if (schema.$ref?.startsWith("#/$defs/")) {
    const name = schema.$ref.slice("#/$defs/".length);
    const target = root.$defs?.[name];
    return target ? schemaType(target, root) : "unknown";
  }
  if (schema.anyOf) return schema.anyOf.map((part) => schemaType(part, root)).join(" | ");
  if (schema.oneOf) return schema.oneOf.map((part) => schemaType(part, root)).join(" | ");
  if (schema.allOf) {
    const { allOf, ...base } = schema;
    const parts = [schemaType(base, root), ...allOf.map((part) => schemaType(part, root))].filter(
      (part) => part !== "unknown",
    );
    return parts.length > 0 ? parts.join(" & ") : "unknown";
  }

  if (Array.isArray(schema.type)) {
    return [...new Set(schema.type.map((type) => schemaType({ ...schema, type }, root)))].join(" | ");
  }

  if (schema.type === "string") return "string";
  if (schema.type === "integer" || schema.type === "number") return "number";
  if (schema.type === "boolean") return "boolean";
  if (schema.type === "null") return "null";
  if (schema.type === "array") return `Array<${schema.items ? schemaType(schema.items, root) : "unknown"}>`;
  if (schema.type === "object") {
    const required = new Set(schema.required ?? []);
    const properties = Object.entries(schema.properties ?? {}).map(([name, property]) => {
      const optional = required.has(name) ? "" : "?";
      return `  ${propertyName(name)}${optional}: ${schemaType(property, root)};`;
    });
    if (schema.additionalProperties && typeof schema.additionalProperties !== "boolean") {
      properties.push(`  [key: string]: ${schemaType(schema.additionalProperties, root)};`);
    } else {
      const indexedType = Object.entries(schema.patternProperties ?? {}).find(([pattern]) => pattern !== "^x-")?.[1];
      if (indexedType) properties.push(`  [key: string]: ${schemaType(indexedType, root)};`);
    }
    return properties.length === 0 ? "Record<string, never>" : `{\n${properties.join("\n")}\n}`;
  }
  return "unknown";
}

export function generateTypes(): void {
  const names = readdirSync(schemaRoot)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.slice(0, -5))
    .sort();
  const sections = [
    "// Generated by the pinned internal schema type generator v1.",
    "// Do not edit. Run `npm run gen:types` to regenerate.",
  ];
  for (const name of names) {
    const schema = JSON.parse(readFileSync(path.join(schemaRoot, `${name}.json`), "utf8")) as JsonSchema;
    sections.push(`\nexport type ${pascalCase(name)} = ${schemaType(schema, schema)};`);
  }
  mkdirSync(path.dirname(typeOutput), { recursive: true });
  writeFileSync(typeOutput, `${sections.join("\n")}\n`, "utf8");
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  if (process.argv[2] === "--generate-types") {
    generateTypes();
  } else {
    throw new Error("Pass --generate-types to generate schema types");
  }
}
