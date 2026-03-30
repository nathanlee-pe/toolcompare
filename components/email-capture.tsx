"use client";

import { useState } from "react";

interface EmailCaptureProps {
  /**
   * "banner"  — full-width horizontal strip, good between content sections
   * "sidebar" — compact card for the tool page sidebar
   * "inline"  — minimal, fits inside prose content
   */
  variant?: "banner" | "sidebar" | "inline";
  /** Which page/section triggered the capture — stored with the subscriber */
  source: string;
}

/**
 * Email capture widget with lead magnet offer.
 * On submit, POSTs to /api/subscribe. Shows success / error feedback inline.
 *
 * Lead magnet copy and provider integration live in /app/api/subscribe/route.ts.
 */
export function EmailCapture({ variant = "banner", source }: EmailCaptureProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "loading") return;

    setStatus("loading");
    setErrorMsg("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, source }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Something went wrong. Please try again.");
      }

      setStatus("success");
      setEmail("");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (status === "success") {
    return (
      <SuccessState variant={variant} />
    );
  }

  if (variant === "sidebar") {
    return (
      <div className="rounded-xl border bg-gradient-to-b from-primary/5 to-card p-5 shadow-sm">
        <div className="mb-1 text-lg">🎁</div>
        <h3 className="mb-1 font-semibold leading-snug">Free SaaS Buyer's Guide</h3>
        <p className="mb-4 text-xs text-muted-foreground leading-relaxed">
          A 20-page PDF comparing pricing, features, and hidden costs across every major category. No spam.
        </p>
        <Form
          email={email}
          status={status}
          errorMsg={errorMsg}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          placeholder="you@company.com"
          buttonText="Send me the guide"
          compact
        />
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className="my-2 flex flex-col gap-2 rounded-lg border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center">
        <p className="text-sm font-medium shrink-0">
          🎁 Get our free SaaS comparison guide →
        </p>
        <Form
          email={email}
          status={status}
          errorMsg={errorMsg}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          placeholder="Enter your email"
          buttonText="Get it free"
          compact
          inline
        />
      </div>
    );
  }

  // Default: banner
  return (
    <section className="rounded-2xl border bg-gradient-to-r from-primary/8 via-primary/5 to-background p-6 sm:p-8">
      <div className="mx-auto max-w-xl text-center">
        <div className="mb-2 text-3xl">🎁</div>
        <h2 className="mb-1 text-xl font-bold tracking-tight">
          The 2026 SaaS Buyer's Guide — Free
        </h2>
        <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
          20 pages. Every major SaaS category ranked. Pricing tables, feature comparisons, and
          the tools our team actually uses. Join 4,000+ subscribers.
        </p>
        <Form
          email={email}
          status={status}
          errorMsg={errorMsg}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          placeholder="your@email.com"
          buttonText="Get the free guide"
        />
        <p className="mt-3 text-xs text-muted-foreground">
          No spam. Unsubscribe any time.
        </p>
      </div>
    </section>
  );
}

// ─── Internal sub-components ──────────────────────────────────────────────────

function Form({
  email,
  status,
  errorMsg,
  onEmailChange,
  onSubmit,
  placeholder,
  buttonText,
  compact = false,
  inline = false,
}: {
  email: string;
  status: "idle" | "loading" | "error";
  errorMsg: string;
  onEmailChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  placeholder: string;
  buttonText: string;
  compact?: boolean;
  inline?: boolean;
}) {
  return (
    <div className={inline ? "flex-1" : undefined}>
      <form
        onSubmit={onSubmit}
        className={`flex gap-2 ${compact || inline ? "" : "flex-col sm:flex-row"}`}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder={placeholder}
          className={`flex-1 rounded-md border bg-background px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 ${compact ? "h-8 text-xs" : "h-10"}`}
          disabled={status === "loading"}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          className={`shrink-0 rounded-md bg-primary px-4 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 ${compact ? "h-8 text-xs" : "h-10 text-sm"}`}
        >
          {status === "loading" ? "Sending…" : buttonText}
        </button>
      </form>
      {status === "error" && errorMsg && (
        <p className="mt-2 text-xs text-destructive">{errorMsg}</p>
      )}
    </div>
  );
}

function SuccessState({ variant }: { variant: string }) {
  const compact = variant === "sidebar" || variant === "inline";
  return (
    <div
      className={`rounded-xl border border-green-200 bg-green-50 text-center ${
        compact ? "p-4" : "p-8"
      }`}
    >
      <div className={compact ? "text-2xl" : "mb-2 text-4xl"}>✅</div>
      <p className={`font-semibold text-green-800 ${compact ? "text-sm" : "text-base"}`}>
        You're in! Check your inbox.
      </p>
      {!compact && (
        <p className="mt-1 text-sm text-green-700">
          Your guide is on its way. Check your spam folder if you don't see it.
        </p>
      )}
    </div>
  );
}
