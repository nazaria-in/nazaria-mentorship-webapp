// /app/api/push/unsubscribe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface UnsubscribeRequestBody {
  endpoint: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient();

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await request.json()) as UnsubscribeRequestBody;

  if (!body.endpoint) {
    return NextResponse.json({ error: "endpoint is required." }, { status: 400 });
  }

  const { error } = await supabase
    .from("push_subscriptions")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", authUser.id)
    .eq("endpoint", body.endpoint);

  if (error) {
    return NextResponse.json({ error: "Failed to remove subscription." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}