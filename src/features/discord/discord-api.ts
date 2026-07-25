type DiscordRequestOptions = {
  method?: "GET" | "POST" | "PATCH";
  body?: unknown;
};

export class DiscordApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function discordApi<T>(
  path: string,
  config: { apiBaseUrl: string; botToken: string },
  options: DiscordRequestOptions = {},
): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bot ${config.botToken}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const details = (await response.text()).slice(0, 500);
    throw new DiscordApiError(`Discord API ${response.status}: ${details}`, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
