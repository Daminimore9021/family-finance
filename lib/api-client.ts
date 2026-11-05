"use client";

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
  constructor(message: string, status: number, fields?: Record<string, string>) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

export async function api<T>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "same-origin",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Network error. Check your internet connection.", 0);
  }
  const json = (await res.json().catch(() => null)) as { data?: T; error?: string; fields?: Record<string, string> } | null;
  if (!res.ok) {
    if (res.status === 401 && !url.startsWith("/api/auth/")) {
      window.location.href = "/login";
    }
    throw new ApiError(json?.error ?? `Request failed (${res.status})`, res.status, json?.fields);
  }
  return json?.data as T;
}

/** Downloads a file from an API endpoint, surfacing JSON errors as exceptions. */
export async function downloadFile(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  } catch {
    throw new ApiError("Network error. Check your internet connection.", 0);
  }
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null;
    if (res.status === 401) window.location.href = "/login";
    throw new ApiError(json?.error ?? `Download failed (${res.status})`, res.status);
  }
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "export";
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  return filename;
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
