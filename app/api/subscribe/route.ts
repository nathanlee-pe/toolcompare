import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Simple email regex — not RFC-perfect, but catches common typos
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, source } =
    typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : {};

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 422 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedSource = typeof source === "string" ? source.slice(0, 100) : "unknown";

  // ── Save to DB ─────────────────────────────────────────────────────────────
  // Silently ignore duplicate emails (upsert on email unique constraint).
  try {
    await prisma.subscriber.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, source: normalizedSource },
      update: { source: normalizedSource }, // update source so we see the latest entry point
    });
  } catch (err) {
    console.error("[subscribe] DB error:", err);
    return NextResponse.json(
      { error: "Could not save your email. Please try again." },
      { status: 500 }
    );
  }

  // ── Forward to email provider ──────────────────────────────────────────────
  // Uncomment and fill in the provider block that matches your stack.
  // The DB record above is the source of truth — provider sync is best-effort.

  // ── Mailchimp ──────────────────────────────────────────────────────────────
  // const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
  // const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;
  // const MAILCHIMP_DC      = MAILCHIMP_API_KEY?.split("-").pop(); // e.g. "us21"
  // if (MAILCHIMP_API_KEY && MAILCHIMP_LIST_ID) {
  //   await fetch(
  //     `https://${MAILCHIMP_DC}.api.mailchimp.com/3.0/lists/${MAILCHIMP_LIST_ID}/members`,
  //     {
  //       method: "POST",
  //       headers: {
  //         Authorization: `Bearer ${MAILCHIMP_API_KEY}`,
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify({
  //         email_address: normalizedEmail,
  //         status: "subscribed",
  //         tags: [normalizedSource],
  //       }),
  //     }
  //   ).catch(console.error); // don't block response on provider failure
  // }

  // ── ConvertKit / Kit ───────────────────────────────────────────────────────
  // const CK_API_KEY = process.env.CONVERTKIT_API_KEY;
  // const CK_FORM_ID = process.env.CONVERTKIT_FORM_ID;
  // if (CK_API_KEY && CK_FORM_ID) {
  //   await fetch(`https://api.convertkit.com/v3/forms/${CK_FORM_ID}/subscribe`, {
  //     method: "POST",
  //     headers: { "Content-Type": "application/json" },
  //     body: JSON.stringify({ api_key: CK_API_KEY, email: normalizedEmail }),
  //   }).catch(console.error);
  // }

  // ── Brevo (formerly Sendinblue) ───────────────────────────────────────────
  // const BREVO_API_KEY  = process.env.BREVO_API_KEY;
  // const BREVO_LIST_ID  = Number(process.env.BREVO_LIST_ID);
  // if (BREVO_API_KEY && BREVO_LIST_ID) {
  //   await fetch("https://api.brevo.com/v3/contacts", {
  //     method: "POST",
  //     headers: {
  //       "api-key": BREVO_API_KEY,
  //       "Content-Type": "application/json",
  //     },
  //     body: JSON.stringify({
  //       email: normalizedEmail,
  //       listIds: [BREVO_LIST_ID],
  //       updateEnabled: true,
  //     }),
  //   }).catch(console.error);
  // }

  return NextResponse.json({ success: true }, { status: 200 });
}
