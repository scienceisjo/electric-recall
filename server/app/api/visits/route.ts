import { env } from "cloudflare:workers";
import { handleGet, handleOptions, handlePost, unsupported } from "../../../lib/visit-counter";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleGet(request, env.DB);
}

export async function POST(request: Request) {
  return handlePost(request, env.DB);
}

export function HEAD(request: Request) { return unsupported(request, true); }
export function PUT(request: Request) { return unsupported(request); }
export function PATCH(request: Request) { return unsupported(request); }
export function DELETE(request: Request) { return unsupported(request); }
export function OPTIONS(request: Request) { return handleOptions(request); }
