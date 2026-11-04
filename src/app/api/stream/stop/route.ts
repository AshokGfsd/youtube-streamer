import { NextResponse } from "next/server";
import { z } from "zod";
import { streamingProvider } from "@/services/streaming-provider";

const stopSchema = z.object({
  streamId: z.string().min(1, "streamId is required"),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = stopSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  try {
    const result = await streamingProvider.stopStream(parsed.data.streamId);
    return NextResponse.json({
      streamId: parsed.data.streamId,
      status: result.status,
      message: result.message,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
