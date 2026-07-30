import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { isIP } from "node:net";

export const KIE_Z_IMAGE_MODEL = "z-image";
export const KIE_Z_IMAGE_RATIOS = ["16:9", "4:3"] as const;

export type KieZImageAspectRatio = (typeof KIE_Z_IMAGE_RATIOS)[number];
export type KieTaskState =
  | "waiting"
  | "queuing"
  | "generating"
  | "success"
  | "fail";

type JsonRecord = Record<string, unknown>;

export class KieImageError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 502) {
    super(message);
    this.name = "KieImageError";
    this.code = code;
    this.status = status;
  }
}

function asRecord(value: unknown): JsonRecord | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function boundedString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function parseJsonRecord(value: unknown): JsonRecord | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return asRecord(value);
}

export function buildKieZImageRequest(input: {
  prompt: string;
  aspectRatio: KieZImageAspectRatio;
  callbackUrl?: string | null;
}) {
  const body: {
    model: typeof KIE_Z_IMAGE_MODEL;
    callBackUrl?: string;
    input: {
      prompt: string;
      aspect_ratio: KieZImageAspectRatio;
      nsfw_checker: true;
    };
  } = {
    model: KIE_Z_IMAGE_MODEL,
    input: {
      prompt: input.prompt.trim(),
      aspect_ratio: input.aspectRatio,
      nsfw_checker: true,
    },
  };

  if (input.callbackUrl?.trim()) {
    body.callBackUrl = input.callbackUrl.trim();
  }

  return body;
}

export function extractKieCallbackTaskId(payload: unknown): string {
  const root = asRecord(payload);
  if (!root) return "";

  const direct =
    boundedString(root.taskId, 300) || boundedString(root.task_id, 300);
  if (direct) return direct;

  const data = asRecord(root.data);
  return (
    boundedString(data?.taskId, 300) || boundedString(data?.task_id, 300)
  );
}

export type KieTaskRecord = {
  taskId: string;
  state: KieTaskState;
  resultUrl: string | null;
  error: string | null;
  progress: number | null;
};

export function parseKieTaskRecord(payload: unknown): KieTaskRecord {
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  if (!data) {
    throw new KieImageError(
      "INVALID_TASK_RESPONSE",
      "KIE returned an invalid task response."
    );
  }

  const taskId = boundedString(data.taskId, 300);
  const rawState = boundedString(data.state, 30).toLowerCase();
  if (!taskId || !["waiting", "queuing", "generating", "success", "fail"].includes(rawState)) {
    throw new KieImageError(
      "INVALID_TASK_RESPONSE",
      "KIE task response is missing a valid task ID or state."
    );
  }

  const result = parseJsonRecord(data.resultJson);
  const resultUrls = Array.isArray(result?.resultUrls)
    ? result.resultUrls
    : Array.isArray(result?.result_urls)
      ? result.result_urls
      : [];
  const resultUrl =
    resultUrls.find((value): value is string => typeof value === "string") ||
    null;
  const rawProgress =
    typeof data.progress === "number"
      ? data.progress
      : Number.parseFloat(String(data.progress ?? ""));

  return {
    taskId,
    state: rawState as KieTaskState,
    resultUrl: resultUrl?.trim() || null,
    error:
      boundedString(data.failMsg, 1000) ||
      boundedString(data.failMessage, 1000) ||
      null,
    progress: Number.isFinite(rawProgress) ? rawProgress : null,
  };
}

export function verifyKieWebhookSignature(input: {
  taskId: string;
  timestamp: string;
  signature: string;
  key: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): boolean {
  const timestampSeconds = Number(input.timestamp);
  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (
    !input.taskId ||
    !input.key ||
    !Number.isInteger(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > toleranceSeconds
  ) {
    return false;
  }

  const expected = createHmac("sha256", input.key)
    .update(`${input.taskId}.${input.timestamp}`)
    .digest();

  let supplied: Buffer;
  try {
    supplied = Buffer.from(input.signature, "base64");
  } catch {
    return false;
  }

  return (
    expected.length === supplied.length &&
    timingSafeEqual(expected, supplied)
  );
}

export function getKieAllowedImageHosts(): string[] {
  const configured =
    process.env.KIE_IMAGE_ALLOWED_HOSTS || "aiquickdraw.com,kie.ai";
  return configured
    .split(",")
    .map((host) => host.trim().toLowerCase().replace(/^\.+/, ""))
    .filter(Boolean);
}

export function assertAllowedKieImageUrl(
  value: string,
  allowedHosts = getKieAllowedImageHosts()
): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new KieImageError(
      "INVALID_RESULT_URL",
      "KIE returned an invalid image URL."
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = allowedHosts.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    isIP(hostname) !== 0 ||
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    !allowed
  ) {
    throw new KieImageError(
      "UNSAFE_RESULT_URL",
      "KIE returned an image URL from an unapproved host."
    );
  }

  return url;
}

export function detectKieImageContentType(
  headerValue: string,
  bytes: Buffer
): "image/jpeg" | "image/png" | "image/webp" | null {
  const headerType = headerValue.split(";")[0].trim().toLowerCase();
  if (["image/jpeg", "image/png", "image/webp"].includes(headerType)) {
    return headerType as "image/jpeg" | "image/png" | "image/webp";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    )
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function getKieApiBaseUrl(): string {
  const configured = process.env.KIE_API_BASE_URL?.trim() || "https://api.kie.ai";
  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new KieImageError(
      "INVALID_API_URL",
      "KIE_API_BASE_URL is invalid.",
      500
    );
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new KieImageError(
      "INVALID_API_URL",
      "KIE_API_BASE_URL must be an HTTPS URL.",
      500
    );
  }
  return url.toString().replace(/\/$/, "");
}

function getKieApiKey(): string {
  const apiKey = process.env.KIE_API_KEY?.trim();
  if (!apiKey) {
    throw new KieImageError(
      "MISSING_API_KEY",
      "KIE_API_KEY is not configured.",
      503
    );
  }
  return apiKey;
}

async function readKieJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new KieImageError(
      "INVALID_API_RESPONSE",
      "KIE returned a non-JSON response."
    );
  }
}

export async function createKieZImageTask(input: {
  prompt: string;
  aspectRatio: KieZImageAspectRatio;
  callbackUrl?: string | null;
}): Promise<string> {
  const response = await fetch(`${getKieApiBaseUrl()}/api/v1/jobs/createTask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getKieApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildKieZImageRequest(input)),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const payload = await readKieJson(response);
  const root = asRecord(payload);
  const data = asRecord(root?.data);
  const taskId = boundedString(data?.taskId, 300);

  if (!response.ok || !taskId) {
    throw new KieImageError(
      "CREATE_TASK_FAILED",
      boundedString(root?.msg, 300) || "KIE could not create the image task.",
      response.status >= 400 ? response.status : 502
    );
  }

  return taskId;
}

export async function getKieTaskRecord(
  taskId: string
): Promise<KieTaskRecord> {
  const endpoint = new URL(
    `${getKieApiBaseUrl()}/api/v1/jobs/recordInfo`
  );
  endpoint.searchParams.set("taskId", taskId);
  const response = await fetch(endpoint, {
    headers: { Authorization: `Bearer ${getKieApiKey()}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = await readKieJson(response);
  if (!response.ok) {
    const root = asRecord(payload);
    throw new KieImageError(
      "TASK_LOOKUP_FAILED",
      boundedString(root?.msg, 300) || "KIE task lookup failed.",
      response.status
    );
  }
  return parseKieTaskRecord(payload);
}

export async function downloadKieGeneratedImage(input: {
  url: string;
  maxBytes: number;
}): Promise<{ bytes: Buffer; contentType: string }> {
  let url = assertAllowedKieImageUrl(input.url);
  let response: Response | null = null;
  for (let redirectCount = 0; redirectCount <= 2; redirectCount += 1) {
    try {
      response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new KieImageError(
        "IMAGE_DOWNLOAD_FAILED",
        "The generated KIE image could not be downloaded."
      );
    }

    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirectCount === 2) {
      throw new KieImageError(
        "IMAGE_DOWNLOAD_FAILED",
        "The generated KIE image returned an invalid redirect."
      );
    }
    url = assertAllowedKieImageUrl(new URL(location, url).toString());
  }

  if (!response?.ok) {
    throw new KieImageError(
      "IMAGE_DOWNLOAD_FAILED",
      `The generated KIE image download returned HTTP ${response?.status || 502}.`
    );
  }

  const declaredBytes = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > input.maxBytes) {
    throw new KieImageError(
      "IMAGE_TOO_LARGE",
      "The generated KIE image exceeds the storage limit."
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0 || bytes.length > input.maxBytes) {
    throw new KieImageError(
      bytes.length === 0 ? "EMPTY_IMAGE" : "IMAGE_TOO_LARGE",
      bytes.length === 0
        ? "KIE returned an empty image."
        : "The generated KIE image exceeds the storage limit."
    );
  }

  const contentType = detectKieImageContentType(
    response.headers.get("content-type") || "",
    bytes
  );
  if (!contentType) {
    throw new KieImageError(
      "UNSUPPORTED_IMAGE",
      "KIE returned an unsupported image format."
    );
  }

  return { bytes, contentType };
}
