/**
 * Cloudflare Workers entry. Workers static assets serve the built SPA (dist/); only /api/*
 * reaches this Worker (see wrangler.jsonc → assets.run_worker_first).
 *
 * Express runs unchanged through Cloudflare's Node HTTP bridge. Secrets and vars set on the
 * Worker arrive in process.env (nodejs_compat), so the job sources and the AI client read them
 * exactly as they do on Node.
 */
import { httpServerHandler } from 'cloudflare:node';
import { setGeoSource, warmGeo } from './geo/index';
import { createApp } from './app';
import zips from './geo/data/zips.tsv';
import places from './geo/data/places.tsv';

// No disk on Workers: the Census tables are bundled as text (wrangler.jsonc → rules).
setGeoSource((file) => (file === 'zips.tsv' ? zips : places));
warmGeo();

const PORT = 8787;
createApp({ compress: false }).listen(PORT);

export default httpServerHandler({ port: PORT });
