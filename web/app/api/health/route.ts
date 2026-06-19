import { NextResponse } from "next/server";
import { supabaseAdminEnabled } from "@/lib/ideas/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    supabaseEnabled: supabaseAdminEnabled(),
    hasServiceKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    hasUrl: Boolean(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
    hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY || process.env.RSI_ANTHROPIC_API_KEY),
  });
}
