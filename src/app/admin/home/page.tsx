import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { createAnnouncement, createEvent, createFight, createFighter, deactivateAnnouncement, removeFighter, updateEventVisibility } from "@/features/home/admin.actions";
import { SearchableSelect } from "@/components/searchable-select";

export const metadata: Metadata = { title: "Home content" };

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; error?: string }>;
}) {
  const [{ notice, error }, fighters, removableFighters, events, announcements, eligibleUsers] = await Promise.all([
    searchParams,
    prisma.fighter.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.fighter.findMany({
      where: { userId: { not: null } },
      include: { user: { select: { displayName: true, name: true } } },
      orderBy: [{ rank: "asc" }, { name: "asc" }],
    }),
    prisma.event.findMany({ orderBy: { startsAt: "desc" }, take: 20 }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.user.findMany({
      where: { status: "ACTIVE", profileCompletedAt: { not: null }, fighterProfile: null, accounts: { some: { provider: "discord" } } },
      select: { id: true, displayName: true, name: true },
      orderBy: { displayName: "asc" },
      take: 500,
    }),
  ]);

  return (
    <main className="admin-page">
      <div className="admin-title"><div><p>Public experience</p><h1>Home content</h1></div><span>Changes publish immediately</span></div>
      {notice && <p className="admin-notice" role="status">{notice}</p>}
      {error && <p className="admin-error" role="alert">{error}</p>}

      <div className="admin-grid">
        <section className="admin-panel">
          <div className="panel-heading"><span>01</span><div><h2>Add a fighter</h2><p>Link an eligible registered player to one official fighter profile.</p></div></div>
          <form action={createFighter} className="admin-form">
            <SearchableSelect name="userId" label="Registered player" options={eligibleUsers.map((user) => ({ value: user.id, label: user.displayName ?? user.name ?? "Unnamed player", details: "Active Discord account" }))} searchPlaceholder="Search player name…" placeholder="Choose an eligible player" help="Players already linked to a fighter are automatically excluded." />
            <label>Fighter name<input name="name" required maxLength={60} /></label>
            <label>Nickname<input name="nickname" maxLength={40} /></label>
            <p className="admin-guidance">Rank is assigned automatically after the current lowest-ranked fighter. Every new or returning fighter starts at 0-0-0.</p>
            <button className="button button-primary" type="submit">Add fighter</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><span>02</span><div><h2>Remove a fighter</h2><p>Archive their fighter profile and remove their fighter access.</p></div></div>
          <form action={removeFighter} className="admin-form">
            <SearchableSelect
              name="fighterId"
              label="Current fighter"
              options={removableFighters.map((fighter) => ({
                value: fighter.id,
                label: `${fighter.rank ? `#${fighter.rank} ` : ""}${fighter.name}`,
                details: `${fighter.user?.displayName ?? fighter.user?.name ?? "Linked player"} · ${fighter.status}`,
              }))}
              searchPlaceholder="Search fighter, player, or rank…"
              placeholder="Choose a fighter to remove"
            />
            <p className="admin-guidance">Completed fight history remains official. Pending requests are cancelled. Scheduled or live fighters cannot be removed.</p>
            <label>Type REMOVE to confirm<input name="confirmation" required autoComplete="off" /></label>
            <button className="button button-danger" type="submit">Remove fighter</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><span>03</span><div><h2>Schedule an event</h2><p>Only scheduled or live events appear publicly.</p></div></div>
          <form action={createEvent} className="admin-form">
            <label>Event title<input name="title" required maxLength={80} /></label>
            <label>Short description<input name="subtitle" maxLength={140} /></label>
            <label>Venue<input name="venue" maxLength={100} /></label>
            <div className="form-row">
              <label>Event date and time<input name="startsAt" type="datetime-local" required /></label>
              <label>Time zone<select name="timezoneOffset" defaultValue="-05:00"><option value="-04:00">Eastern daylight (UTC−4)</option><option value="-05:00">Central daylight / Eastern standard (UTC−5)</option><option value="-06:00">Central standard / Mountain daylight (UTC−6)</option><option value="-07:00">Mountain standard / Pacific daylight (UTC−7)</option><option value="-08:00">Pacific standard (UTC−8)</option><option value="Z">UTC</option></select></label>
            </div>
            <div className="form-row">
              <label>Status<select name="status" defaultValue="SCHEDULED"><option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="LIVE">Live</option></select></label>
              <label className="admin-check"><input name="featured" type="checkbox" /> Feature on Home</label>
            </div>
            <button className="button button-primary" type="submit">Save event</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><span>04</span><div><h2>Add a fight</h2><p>Attach two existing fighters to an event.</p></div></div>
          <form action={createFight} className="admin-form">
            <SearchableSelect name="eventId" label="Event" options={events.map((event) => ({ value: event.id, label: event.title, details: event.startsAt.toLocaleString("en-US") }))} searchPlaceholder="Search event title…" />
            <div className="form-row">
              <SearchableSelect name="redFighterId" label="Red corner" options={fighters.map((fighter) => ({ value: fighter.id, label: `#${fighter.rank ?? "Unranked"} ${fighter.name}`, details: `${fighter.wins}-${fighter.losses}-${fighter.draws}` }))} searchPlaceholder="Search fighter or rank…" />
              <SearchableSelect name="blueFighterId" label="Blue corner" options={fighters.map((fighter) => ({ value: fighter.id, label: `#${fighter.rank ?? "Unranked"} ${fighter.name}`, details: `${fighter.wins}-${fighter.losses}-${fighter.draws}` }))} searchPlaceholder="Search fighter or rank…" />
            </div>
            <label>Fight order<input name="position" type="number" min="1" defaultValue="1" required /></label>
            <button className="button button-primary" type="submit">Add fight</button>
          </form>
        </section>

        <section className="admin-panel">
          <div className="panel-heading"><span>05</span><div><h2>Post an announcement</h2><p>Keep it short and useful.</p></div></div>
          <form action={createAnnouncement} className="admin-form">
            <label>Message<input name="message" required maxLength={180} /></label>
            <div className="form-row">
              <label>Link label<input name="linkLabel" maxLength={30} /></label>
              <label>Internal link<input name="linkUrl" placeholder="/play" maxLength={300} /></label>
            </div>
            <button className="button button-primary" type="submit">Publish announcement</button>
          </form>
          {announcements.length > 0 && <div className="current-content"><strong>Active</strong>{announcements.map((item) => <div className="content-row" key={item.id}><p>{item.message}</p><form action={deactivateAnnouncement}><input name="id" type="hidden" value={item.id} /><button type="submit">Remove</button></form></div>)}</div>}
        </section>

        {events.length > 0 && (
          <section className="admin-panel admin-panel-wide">
            <div className="panel-heading"><span>06</span><div><h2>Publishing controls</h2><p>Move events between draft, scheduled, live, and completed.</p></div></div>
            <div className="event-control-list">
              {events.map((event) => (
                <form action={updateEventVisibility} className="event-control" key={event.id}>
                  <input name="eventId" type="hidden" value={event.id} />
                  <div><strong>{event.title}</strong><small>{event.startsAt.toISOString()}</small></div>
                  <select aria-label={`${event.title} status`} defaultValue={event.status} name="status">
                    <option value="DRAFT">Draft</option><option value="SCHEDULED">Scheduled</option><option value="LIVE">Live</option><option value="COMPLETED">Completed</option><option value="CANCELLED">Cancelled</option>
                  </select>
                  <label><input defaultChecked={event.featured} name="featured" type="checkbox" /> Featured</label>
                  <button className="button button-small" type="submit">Save</button>
                </form>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
