function replaceEnvReferences(
  value: string,
  format: (variableName: string) => string,
): string {
  return value.replace(/\$\{(?!env:|input:)([^}]+)\}/g, (_, variableName: string) => format(variableName));
}

export function toVscodeFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `\${env:${variableName}}`);
}

export function toEnvScopedFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `\${env:${variableName}}`);
}

export function toKiloFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `{env:${variableName}}`);
}

export function toGeminiEnvFormat(value: string): string {
  return replaceEnvReferences(value, (variableName) => `$${variableName}`);
}

export function resolveEnvReferences(value: string): string {
  return replaceEnvReferences(value, (variableName) => process.env[variableName] ?? "");
}

export function extractDirectEnvReference(value: string): string | null {
  const match = value.match(/^\$\{(?!env:|input:)([^}]+)\}$/);
  return match?.[1] ?? null;
}
