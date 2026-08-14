import { getUploads, jsonError, requireSession } from "@/db/runtime";

export async function GET(request: Request) {
  try {
    await requireSession(request);
    const key = new URL(request.url).searchParams.get("key");
    if (!key || !key.startsWith("proofs/")) return new Response("Not found", { status: 404 });
    const object = await getUploads().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, {
      headers: {
        "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
        "Cache-Control": "private, max-age=300",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
