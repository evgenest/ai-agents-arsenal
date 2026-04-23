import type { McpServer } from "../../../config/mcp.config";

export function isHttpServer(server: McpServer): server is Extract<McpServer, { type: "http" }> {
  return "type" in server && server.type === "http";
}

export function mapStringRecord(
  record: Record<string, string> | undefined,
  transform: (value: string) => string,
): Record<string, string> | undefined {
  if (!record) return undefined;

  return Object.fromEntries(
    Object.entries(record).map(([key, value]) => [key, transform(value)]),
  );
}
