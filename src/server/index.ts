import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { api } from './routes/api';
import { menu } from './routes/menu';
import { pvp } from './routes/pvp';

const app = new Hono();
const internal = new Hono();

internal.route('/menu', menu);

app.route('/api', api);
app.route('/api/pvp', pvp);
app.route('/internal', internal);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
