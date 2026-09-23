/**
 * Shared-secret gate for the proxy.
 *
 * Only the Deccan Birders site calls this API, and it calls from its own
 * server — the browser never talks to us directly. So a secret header is
 * the whole check: no origin to trust, no visitor IP to count, nothing
 * reaching anyone's browser.
 *
 * It matters because the eBird key behind this proxy is ours. The API
 * terms make us responsible for every call made with it, "whether or not
 * authorized by you", and abuse can have the key suspended. An open
 * proxy is that abuse waiting to happen.
 *
 * With no DB_PROXY_SECRET set the API stays open, so that deploying this
 * ahead of the site's own release doesn't take the site down. Set the
 * variable to close it.
 */
const SECRET = process.env.DB_PROXY_SECRET;

function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Returns true when the request may proceed. Otherwise it has already
 * answered with 401 and the caller should return.
 */
function authorize(req, res) {
  if (!SECRET) return true; // not configured yet — open, as before

  const sent = req.headers['x-db-key'];
  if (typeof sent === 'string' && timingSafeEqual(sent, SECRET)) return true;

  res.status(401).json({ error: true, message: 'Unauthorized' });
  return false;
}

module.exports = { authorize };
