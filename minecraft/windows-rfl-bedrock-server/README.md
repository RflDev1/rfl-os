# RFL Bedrock Windows host

This folder is the portable handoff for the Windows PC that will host the RFL Bedrock arena. It does not contain PlayRFL database credentials and must never be given them. The included bridge starts Bedrock Dedicated Server, reports lobby presence, validates private fight codes through PlayRFL, tracks a best-of-three series, and submits one signed final result.

## What the Windows AI/operator must do

1. Install 64-bit Node.js 20 or newer.
2. Download the current **Bedrock Dedicated Server for Windows** directly from Minecraft/Microsoft and extract it to `C:\RFL\bedrock-server`. The executable must be `C:\RFL\bedrock-server\bedrock_server.exe`.
3. Import the supplied `assets/RFL_BedWars_1.0.14.mcworld.zip` world into that BDS installation and install the supplied behavior/resource packs. Preserve the behavior-pack scripts; they emit the authenticated bridge events.
4. Copy `.env.example` to `.env` and set each value. `RFL_BRIDGE_SECRET` must exactly equal the encrypted `FIGHT_POOL_BRIDGE_SECRET` value configured on DigitalOcean. Never commit or share `.env`.
5. Configure `server.properties` with the same UDP port as `RFL_SERVER_PORT`, enable the behavior pack and Script API experiments required by the supplied world, and allow that UDP port through Windows Firewall and the router if remote players will connect.
6. Run `npm run check`, then right-click `start-rfl.ps1` and choose **Run with PowerShell**.

## Local test order

1. On PlayRFL, leave `FIGHT_POOL_ENABLED=false` until the server heartbeat appears in Control Center → Fighter Pool.
2. Create two test fighter accounts with exact Bedrock gamertags and ranks no more than five apart.
3. Both players join the lobby/server. Confirm the site shows “RFL lobby presence confirmed.” For a single-server local test, set this instance to `LOBBY`, verify presence, then switch it to `ARENA` and restart. Production should use separate lobby and arena instances.
4. Change `FIGHT_POOL_ENABLED=true` on DigitalOcean and redeploy.
5. Both fighters enter the pool and receive private codes. In Bedrock each uses `/rfl:fight CODE` (or `!fight CODE` if custom commands are unavailable). Before the game begins, either fighter can cancel from PlayRFL; the match is cancelled for both fighters and the arena is released without changing records or Crowns.
6. When the BedWars engine begins gameplay, the behavior pack emits `[RFL][MATCH_STARTED]` and the bridge signs a request to `POST /api/fighter-pool/bridge/start`. Confirm PlayRFL changes the match to `LIVE` and removes the cancellation option.
7. Play until one fighter wins two rounds. Confirm the match, record, rank, and 100-Crown default reward update once.
8. In Control Center → Fighter Pool, open the completed match and test Uphold, Reverse, or Void with a test result.

## Important operational limits

- This is a test host, not yet a hardened public game-server fleet.
- One BDS arena process hosts one fight at a time. More simultaneous fights require separate BDS instance directories, ports, and unique `RFL_SERVER_ID` values.
- The bridge authenticates requests with HMAC-SHA-256 and rejects stale requests. Keep the Windows clock synchronized.
- A power loss during a match can require an admin to resolve or void it.
- The supplied gameplay pack resets its arena between rounds. Fully test map restoration, disconnect behavior, and result reporting before allowing official records.
- Do not expose RCON or any database port to the internet.
