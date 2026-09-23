/** Types for the Cloudflare Worker entry (server/worker.ts). */
declare module 'cloudflare:node' {
  export function httpServerHandler(options: { port: number }): ExportedHandler;
  interface ExportedHandler {
    fetch?: (request: Request, env: unknown, ctx: unknown) => Response | Promise<Response>;
  }
}

/** wrangler.jsonc bundles the geo tables as Text modules. */
declare module '*.tsv' {
  const text: string;
  export default text;
}
