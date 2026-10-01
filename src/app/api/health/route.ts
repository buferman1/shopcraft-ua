export function GET() {
  return Response.json({ status: "not_ready", stage: "foundation", database: "not_connected" },
    { status: 503, headers: { "Cache-Control": "no-store" } });
}
