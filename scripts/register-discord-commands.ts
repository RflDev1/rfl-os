const required = ["DISCORD_CLIENT_ID", "DISCORD_BOT_TOKEN", "DISCORD_GUILD_ID", "DISCORD_API_BASE_URL"] as const;

async function main() {
  for (const name of required) {
    if (!process.env[name]) throw new Error(`Missing ${name}.`);
  }

  const apiBaseUrl = process.env.DISCORD_API_BASE_URL!.replace(/\/$/, "");
  const response = await fetch(
    `${apiBaseUrl}/applications/${process.env.DISCORD_CLIENT_ID}/guilds/${process.env.DISCORD_GUILD_ID}/commands`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: "loadrfl",
        description: "Build or synchronize the official RFL Discord server layout.",
        type: 1,
        dm_permission: false,
      }),
    },
  );

  if (!response.ok) throw new Error(`Discord command registration failed (${response.status}): ${(await response.text()).slice(0, 500)}`);
  const command = await response.json() as { id: string; name: string };
  console.log(`Registered /${command.name} (${command.id}) in the RFL Discord server.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
