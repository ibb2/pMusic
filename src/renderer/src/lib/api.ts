export const API_BASE_URL = "http://127.0.0.1:34567";

type ApiFetchOptions = {
  retryOnReconnect?: boolean;
};

export class ApiResponseError extends Error {
  status: number;
  body: unknown;

  constructor(response: Response, body: unknown) {
    super(`Request failed with status ${response.status}`);
    this.name = "ApiResponseError";
    this.status = response.status;
    this.body = body;
  }
}

let reconnectPromise: Promise<string> | null = null;

export async function initializePlexBackend(librariesOverride?: unknown[]) {
  const accessToken = await window.api.auth.getUserAccessToken();
  const libraries =
    librariesOverride ??
    (await window.api.auth.getUserSelectedLibraries()) ??
    [];
  const serverUrl = await window.api.auth.resolveServerConnection("auto");

  const response = await fetch(`${API_BASE_URL}/init`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      serverUrl,
      libraries,
    }),
  });

  if (!response.ok) {
    throw new ApiResponseError(response, await readResponseBody(response));
  }

  return serverUrl;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
  options: ApiFetchOptions = {},
) {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  let response = await fetch(url, init);

  if (
    response.ok ||
    options.retryOnReconnect === false ||
    !(await isPlexConnectionFailure(response.clone()))
  ) {
    return response;
  }

  await reconnectPlex();
  response = await fetch(url, init);

  return response;
}

export async function apiJson<T = any>(
  path: string,
  init?: RequestInit,
  options?: ApiFetchOptions,
): Promise<T> {
  const response = await apiFetch(path, init, options);

  if (!response.ok) {
    throw new ApiResponseError(response, await readResponseBody(response));
  }

  return response.json() as Promise<T>;
}

async function reconnectPlex() {
  if (!reconnectPromise) {
    reconnectPromise = initializePlexBackend()
      .then((serverUrl) => {
        window.dispatchEvent(
          new CustomEvent("rayna:plex-reconnected", {
            detail: { serverUrl },
          }),
        );
        return serverUrl;
      })
      .finally(() => {
        reconnectPromise = null;
      });
  }

  return reconnectPromise;
}

async function isPlexConnectionFailure(response: Response) {
  if (response.status !== 503) {
    return false;
  }

  const body = await readResponseBody(response);
  const detail = getRecord(body)?.detail;
  const code = getRecord(detail)?.code ?? getRecord(body)?.code;

  return code === "PLEX_CONNECTION_FAILED";
}

async function readResponseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  try {
    return await response.text();
  } catch {
    return null;
  }
}

function getRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }

  return null;
}
