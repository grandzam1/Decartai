import { createDecartClient } from "@decartai/sdk";
import { NextRequest, NextResponse } from "next/server";

const ALLOWED_MODELS = ["lucy-2.6", "lucy-vton-3.6", "lucy-restyle-2"] as const;

// --- Rate Limiting Store (In-Memory Sliding Window) ---
interface RateLimitRecord {
  timestamps: number[];
  lastRequest: number;
}

const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 6; // max 6 tokens per minute per IP
const MIN_INTERVAL_MS = 2000; // minimum 2 seconds between token requests
const MAX_REQUESTS_PER_HOUR = 40;
const HOUR_WINDOW_MS = 60 * 60 * 1000;

// Periodic cleanup of stale rate limit entries
function cleanupRateLimitStore() {
  const now = Date.now();
  for (const [ip, record] of rateLimitMap.entries()) {
    record.timestamps = record.timestamps.filter((t) => now - t < HOUR_WINDOW_MS);
    if (record.timestamps.length === 0 && now - record.lastRequest > HOUR_WINDOW_MS) {
      rateLimitMap.delete(ip);
    }
  }
}

// Check and update rate limit for an IP
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number; remaining: number } {
  const now = Date.now();
  if (Math.random() < 0.1) cleanupRateLimitStore();

  let record = rateLimitMap.get(ip);
  if (!record) {
    record = { timestamps: [], lastRequest: 0 };
    rateLimitMap.set(ip, record);
  }

  // Filter timestamps within the hour window
  record.timestamps = record.timestamps.filter((t) => now - t < HOUR_WINDOW_MS);

  // Burst protection check
  if (record.lastRequest && now - record.lastRequest < MIN_INTERVAL_MS) {
    const retryAfter = Math.ceil((MIN_INTERVAL_MS - (now - record.lastRequest)) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Hour limit check
  if (record.timestamps.length >= MAX_REQUESTS_PER_HOUR) {
    const oldestInHour = record.timestamps[0];
    const retryAfter = Math.ceil((HOUR_WINDOW_MS - (now - oldestInHour)) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // 1-minute window limit check
  const recentInWindow = record.timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recentInWindow.length >= MAX_REQUESTS_PER_WINDOW) {
    const oldestInWindow = recentInWindow[0];
    const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - oldestInWindow)) / 1000);
    return { allowed: false, retryAfter, remaining: 0 };
  }

  // Register request
  record.timestamps.push(now);
  record.lastRequest = now;
  const remaining = MAX_REQUESTS_PER_WINDOW - (recentInWindow.length + 1);

  return { allowed: true, remaining: Math.max(0, remaining) };
}

// Extract client IP address safely
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0].trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

// --- Access Control Validation ---
function validateAccess(req: NextRequest): { valid: boolean; reason?: string } {
  // 1. Check sec-fetch-site header if available (protect against cross-site CSRF)
  const secFetchSite = req.headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite === "cross-site") {
    return { valid: false, reason: "Cross-site requests are not permitted." };
  }

  // 2. Validate Origin / Referer if present
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");

  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      const isLocal = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
      const matchesHost = originUrl.host.toLowerCase() === host.toLowerCase();
      const isAppEngineRun = originUrl.hostname.endsWith(".run.app") || originUrl.hostname.endsWith(".google.com");

      if (!isLocal && !matchesHost && !isAppEngineRun) {
        return { valid: false, reason: "Unauthorized origin header." };
      }
    } catch {
      return { valid: false, reason: "Malformed origin header." };
    }
  }

  return { valid: true };
}

export async function POST(req: NextRequest) {
  // 1. Access Control Check
  const access = validateAccess(req);
  if (!access.valid) {
    return NextResponse.json(
      { error: access.reason || "Access denied." },
      { status: 403 }
    );
  }

  // 2. Rate Limiting Check
  const clientIp = getClientIp(req);
  const rateLimit = checkRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait a moment before requesting another session token.",
        retryAfter: rateLimit.retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfter ?? 10),
          "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  // 3. Server-Only Environment Variable Verification
  const apiKey = process.env.DECART_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error: "DECART_API_KEY is not configured on the server. Please add DECART_API_KEY to your environment variables.",
        code: "MISSING_DECART_API_KEY",
      },
      { status: 500 }
    );
  }

  // 4. Create short-lived token restricted to allowed models and request origin
  try {
    const origin = req.headers.get("origin") || undefined;
    const client = createDecartClient({ apiKey });

    const token = await client.tokens.create({
      expiresIn: 60,
      allowedModels: [...ALLOWED_MODELS],
      allowedOrigins: origin ? [origin] : undefined,
      constraints: {
        realtime: {
          maxSessionDuration: 300, // 5 minutes max session
        },
      },
    });

    return NextResponse.json(token, {
      headers: {
        "X-RateLimit-Limit": String(MAX_REQUESTS_PER_WINDOW),
        "X-RateLimit-Remaining": String(rateLimit.remaining),
      },
    });
  } catch (error) {
    console.error("Failed to create Decart client token:", error);
    return NextResponse.json(
      { error: "Could not create a Decart session token. Please verify your DECART_API_KEY." },
      { status: 502 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST to request a realtime session token." },
    { status: 405, headers: { Allow: "POST" } }
  );
}
