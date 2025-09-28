export function health(req, res) {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    env: process.env.NODE_ENV || 'development',
    now: new Date().toISOString(),
  });
}
