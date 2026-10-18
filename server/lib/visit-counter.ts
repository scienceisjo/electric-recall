const MAX_BODY_BYTES = 512;
const SITE_NAMESPACE = "science-is-jo-electric-recall-v1";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const GITHUB_PAGES_ORIGIN = "https://scienceisjo.github.io";
const COUNT_SQL = `SELECT
  (SELECT COUNT(*) FROM daily_visits WHERE day = ?) AS today,
  (SELECT COUNT(*) FROM daily_visits) AS total`;

type CountsRow = { today: number; total: number };

export function kstDate(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function canonicalVisitorId(value: unknown): string {
  // Python uuid.UUID's canonical lowercase representation; no UUID version
  // restriction, so existing browser identifiers remain accepted.
  if (typeof value !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)) {
    throw new Error("invalid_visitor_payload");
  }
  return value;
}

export async function visitorDigest(day: string, visitorId: string): Promise<string> {
  const input = new TextEncoder().encode(`${SITE_NAMESPACE}\0${day}\0${visitorId}`);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function sameOrigin(request: Request): boolean {
  const value = request.headers.get("origin");
  if (value === null) return true;
  // Browser Origin is only scheme + authority, never a path or credentials.
  if (!/^https?:\/\/[^/?#]+$/i.test(value)) return false;
  try {
    const origin = new URL(value);
    return !origin.username && !origin.password && origin.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function allowedOrigin(request: Request): boolean {
  return sameOrigin(request) || request.headers.get("origin") === GITHUB_PAGES_ORIGIN;
}

function responseHeaders(request: Request): Headers {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Vary": "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin !== null && allowedOrigin(request)) {
    headers.set("Access-Control-Allow-Origin", origin);
  }
  return headers;
}

function json(request: Request, status: number, payload: object, allow?: string): Response {
  const headers = responseHeaders(request);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (allow) headers.set("Allow", allow);
  return new Response(JSON.stringify(payload), { status, headers });
}

function snapshot(request: Request, row: CountsRow | null | undefined, day: string): Response {
  if (!row || !Number.isSafeInteger(row.today) || !Number.isSafeInteger(row.total)
      || row.today < 0 || row.total < row.today) {
    throw new Error("invalid_counter_result");
  }
  return json(request, 200, { today: row.today, total: row.total, date: day,
    timezone: "Asia/Seoul", mode: "live" });
}

export async function handleGet(request: Request, db: D1Database | undefined,
  clock = () => new Date()): Promise<Response> {
  if (!allowedOrigin(request)) return json(request, 403, { error: "origin_not_allowed" });
  if (!db) return json(request, 503, { error: "counter_unavailable" });
  try {
    const day = kstDate(clock());
    // Both counts come from one SQL statement and one database snapshot.
    const row = await db.prepare(COUNT_SQL).bind(day).first<CountsRow>();
    return snapshot(request, row, day);
  } catch {
    // Do not return/log binding details, identifiers, addresses or payloads.
    return json(request, 503, { error: "counter_unavailable" });
  }
}

class BodyError extends Error {
  status: number;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
  }
}

async function readVisitorId(request: Request): Promise<string> {
  const contentType = request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
  if (contentType !== "application/json") throw new BodyError(415, "application_json_required");
  const lengthValue = request.headers.get("content-length");
  if (lengthValue !== null) {
    if (!/^\d+$/.test(lengthValue)) throw new BodyError(400, "invalid_body_length");
    const length = Number(lengthValue);
    if (length > MAX_BODY_BYTES) throw new BodyError(413, "body_too_large");
    if (length < 1) throw new BodyError(400, "invalid_body_length");
  }
  if (!request.body) throw new BodyError(400, "invalid_visitor_payload");
  // Enforce the limit on actual bytes, including requests without a length
  // header; never buffer an unbounded request with request.json().
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new BodyError(413, "body_too_large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  if (lengthValue !== null && size !== Number(lengthValue)) throw new BodyError(400, "invalid_body_length");
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)
        || Object.keys(payload).length !== 1 || !("visitorId" in payload)) throw new Error();
    return canonicalVisitorId(payload.visitorId);
  } catch {
    throw new BodyError(400, "invalid_visitor_payload");
  }
}

export async function handlePost(request: Request, db: D1Database | undefined,
  clock = () => new Date()): Promise<Response> {
  if (!allowedOrigin(request)) return json(request, 403, { error: "origin_not_allowed" });
  let visitorId: string;
  try {
    visitorId = await readVisitorId(request);
  } catch (error) {
    return error instanceof BodyError
      ? json(request, error.status, { error: error.message })
      : json(request, 400, { error: "invalid_visitor_payload" });
  }
  if (!db) return json(request, 503, { error: "counter_unavailable" });
  try {
    // Capture KST day once for the hash, insert, counts and response, even if
    // this request crosses midnight while the database call is in flight.
    const day = kstDate(clock());
    const digest = await visitorDigest(day, visitorId);
    // D1 batch is a transaction. The composite key + INSERT OR IGNORE make
    // simultaneous refreshes/tabs idempotent; no runtime schema changes.
    const results = await db.batch<CountsRow>([
      db.prepare("INSERT OR IGNORE INTO daily_visits (day, visitor_digest) VALUES (?, ?)").bind(day, digest),
      db.prepare(COUNT_SQL).bind(day),
    ]);
    if (results.length !== 2 || results.some((result) => !result.success)) throw new Error("counter_failed");
    return snapshot(request, results[1].results[0], day);
  } catch {
    return json(request, 503, { error: "counter_unavailable" });
  }
}

export function handleOptions(request: Request): Response {
  // Preflight checks only declared origin/method/header values. It never
  // accesses the database, creates an identifier, or records a visit.
  let response: Response;
  if (!request.headers.has("origin") || !allowedOrigin(request)) {
    response = json(request, 403, { error: "origin_not_allowed" });
  } else {
    const method = request.headers.get("access-control-request-method");
    const requestedHeaders = request.headers.get("access-control-request-headers");
    const headersAllowed = requestedHeaders === null || requestedHeaders.split(",")
      .every((header) => header.trim().toLowerCase() === "content-type");
    if (method !== "GET" && method !== "POST") {
      response = json(request, 405, { error: "method_not_allowed" }, "GET, POST, OPTIONS");
    } else if (!headersAllowed) {
      response = json(request, 403, { error: "headers_not_allowed" });
    } else {
      const headers = responseHeaders(request);
      headers.set("Access-Control-Allow-Methods", "GET, POST");
      headers.set("Access-Control-Allow-Headers", "Content-Type");
      response = new Response(null, { status: 204, headers });
    }
  }
  response.headers.set("Vary", "Origin, Access-Control-Request-Method, Access-Control-Request-Headers");
  return response;
}

export function unsupported(request: Request, head = false): Response {
  const response = allowedOrigin(request)
    ? json(request, 405, { error: "method_not_allowed" }, "GET, POST, OPTIONS")
    : json(request, 403, { error: "origin_not_allowed" });
  return head ? new Response(null, { status: response.status, headers: response.headers }) : response;
}
