import { Pool } from "pg";

/**
 * Creates the Postgres pool. When a CA certificate is given (DigitalOcean managed databases),
 * the server is verified against it. sslmode is removed from the URL because pg lets URL
 * settings override the ssl option, and its sslmode=require would verify against system CAs.
 */
export function createPool(databaseUrl: string, caCert?: string): Pool {
  if (!caCert) {
    return new Pool({ connectionString: databaseUrl });
  }

  const url = new URL(databaseUrl);
  url.searchParams.delete("sslmode");

  return new Pool({ connectionString: url.toString(), ssl: { ca: caCert } });
}
