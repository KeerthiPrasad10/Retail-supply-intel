import { NextResponse } from "next/server";

/**
 * Triggers an on-demand data refresh from inside the dashboard, so a buyer
 * never has to touch GitHub. This server route dispatches the `refresh.yml`
 * pipeline workflow; the GitHub token lives only in server env (never shipped
 * to the browser). The free Wikipedia refresh runs by default — the paid Apify
 * feeds stay an explicit ops action and are not exposed here.
 *
 * Configure on Vercel (Project → Settings → Environment Variables):
 *   GITHUB_DISPATCH_TOKEN  fine-grained PAT with Actions: Read and write on the repo
 *                          (the only required value — only you can mint it)
 *   GITHUB_REPO            optional override; defaults to this repo
 *   GITHUB_REF             optional; defaults to "main"
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_REPO = "KeerthiPrasad10/Retail-supply-intel";

export async function POST() {
  const token = process.env.GITHUB_DISPATCH_TOKEN;
  const repo = process.env.GITHUB_REPO || DEFAULT_REPO;
  const ref = process.env.GITHUB_REF || "main";

  if (!token) {
    return NextResponse.json(
      { ok: false, error: "Refresh isn’t configured (set GITHUB_DISPATCH_TOKEN)." },
      { status: 501 },
    );
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${repo}/actions/workflows/refresh.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        // Free Wikipedia refresh + recompute + publish. (apify omitted on purpose.)
        body: JSON.stringify({ ref }),
      },
    );

    if (res.status !== 204) {
      const detail = await res.text();
      return NextResponse.json(
        { ok: false, error: `GitHub dispatch failed (${res.status}): ${detail.slice(0, 200)}` },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "dispatch error" },
      { status: 502 },
    );
  }
}
