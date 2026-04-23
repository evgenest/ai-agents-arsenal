import { type McpServer } from "../../../config/mcp.config";
import { resolveEnvReferences, toEnvScopedFormat, toGeminiEnvFormat, toKiloFormat, toVscodeFormat } from "./env";
import type { JsonObject } from "./json";
import { isHttpServer, mapStringRecord } from "./server";

export function convertServerForAntigravity(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      serverUrl: resolveEnvReferences(server.url),
      headers: mapStringRecord(server.headers, resolveEnvReferences),
    };
  }

  return {
    command: server.command,
    args: server.args?.map(resolveEnvReferences),
    env: mapStringRecord(server.env, resolveEnvReferences),
  };
}

export function convertServerForVscode(server: McpServer): McpServer {
  if (isHttpServer(server)) {
    return {
      ...server,
      url: toVscodeFormat(server.url),
      headers: mapStringRecord(server.headers, toVscodeFormat),
    };
  }

  return {
    ...server,
    command: toVscodeFormat(server.command),
    args: server.args?.map(toVscodeFormat),
    env: mapStringRecord(server.env, toVscodeFormat),
  };
}

export function convertServerForCursor(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      url: toEnvScopedFormat(server.url),
      headers: mapStringRecord(server.headers, toEnvScopedFormat),
      transport: "streamable-http",
    };
  }

  return {
    command: toEnvScopedFormat(server.command),
    args: server.args?.map(toEnvScopedFormat),
    env: mapStringRecord(server.env, toEnvScopedFormat),
  };
}

export function convertServerForWindsurf(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      serverUrl: toEnvScopedFormat(server.url),
      headers: mapStringRecord(server.headers, toEnvScopedFormat),
    };
  }

  return {
    command: toEnvScopedFormat(server.command),
    args: server.args?.map(toEnvScopedFormat),
    env: mapStringRecord(server.env, toEnvScopedFormat),
  };
}

export function convertServerForGemini(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      httpUrl: server.url,
      headers: mapStringRecord(server.headers, resolveEnvReferences),
      includeTools: server.tools,
    };
  }

  return {
    command: server.command,
    args: server.args?.map(resolveEnvReferences),
    env: mapStringRecord(server.env, toGeminiEnvFormat),
    includeTools: server.tools,
  };
}

export function convertServerForKilo(server: McpServer): JsonObject {
  if (isHttpServer(server)) {
    return {
      type: "remote",
      url: server.url,
      headers: mapStringRecord(server.headers, toKiloFormat),
      enabled: true,
    };
  }

  const args = server.args?.map(toKiloFormat) ?? [];
  const command = process.platform === "win32"
    ? ["cmd", "/c", toKiloFormat(server.command), ...args]
    : [toKiloFormat(server.command), ...args];

  return {
    type: "local",
    command,
    environment: mapStringRecord(server.env, toKiloFormat),
    enabled: true,
  };
}
