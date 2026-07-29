import type { Metadata } from "next";
import { SearchableSelect } from "@/components/searchable-select";
import {
  createCardAction, createPackAction, createSetAction,
  deleteCardAction, deletePackAction, deleteSetAction,
  updateCardAction, updatePackAction, updateSetAction,
} from "@/features/cards/cards.actions";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Cards and packs" };

const localDateTime = (date: Date) => {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
};

const rarities = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

export default async function AdminCardsPage({ searchParams }: { searchParams: Promise<{ notice?: string; error?: string }> }) {
  const [{ notice, error }, sets, fighters, cards, packs] = await Promise.all([
    searchParams,
    prisma.cardSet.findMany({ include: { _count: { select: { definitions: true, packs: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.fighter.findMany({ where: { status: "ACTIVE" }, orderBy: { name: "asc" } }),
    prisma.cardDefinition.findMany({ include: { set: true, _count: { select: { instances: true } } }, orderBy: [{ set: { code: "asc" } }, { cardNumber: "asc" }] }),
    prisma.packDefinition.findMany({ include: { set: true, _count: { select: { openings: true } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const setOptions = sets.map((set) => ({ value: set.id, label: `${set.code} · ${set.name}`, details: `${set._count.definitions} cards` }));
  const fighterOptions = fighters.map((fighter) => ({ value: fighter.id, label: `#${fighter.rank ?? "Unranked"} ${fighter.name}`, details: `${fighter.wins}-${fighter.losses}-${fighter.draws}` }));

  return <main className="admin-page">
    <div className="admin-title"><div><p>Collectibles operations</p><h1>Cards and packs</h1></div><span>Publishing creates permanent collectible history</span></div>
    {notice && <p className="admin-notice">{notice}</p>}{error && <p className="admin-error">{error}</p>}
    <div className="card-admin-grid">
      <section className="admin-panel"><div className="panel-heading"><span>01</span><div><h2>Create set</h2><p>Activate only when its catalog is ready.</p></div></div>
        <form action={createSetAction} className="admin-form"><label>Name<input name="name" required /></label><label>Code<input name="code" maxLength={12} placeholder="RFL01" required /></label><label>Description<textarea name="description" maxLength={500} /></label><label>Release time<input name="releasedAt" type="datetime-local" required /></label><label className="check-label"><input name="active" type="checkbox" /> Publicly active</label><button className="button button-primary">Create set</button></form>
      </section>
      <section className="admin-panel"><div className="panel-heading"><span>02</span><div><h2>Add card</h2><p>Upload original card art or provide an existing HTTPS image.</p></div></div>
        <form action={createCardAction} className="admin-form"><SearchableSelect name="setId" label="Card set" options={setOptions} searchPlaceholder="Search card sets…" /><SearchableSelect name="fighterId" label="Linked fighter (optional)" required={false} placeholder="No fighter link" options={fighterOptions} searchPlaceholder="Search fighters…" /><label>Name<input name="name" required /></label><label>Subtitle<input name="subtitle" maxLength={120} /></label><label>Card artwork<input accept="image/jpeg,image/png,image/webp" name="image" type="file" /><small>JPG, PNG, or WebP · maximum 5 MB · stored with the RFL database</small></label><label>Or existing HTTPS image URL<input name="imageUrl" placeholder="https://..." type="url" /></label><div className="form-row"><label>Rarity<select name="rarity">{rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}</select></label><label>Card number<input min="1" max="9999" name="cardNumber" type="number" required /></label></div><label className="check-label"><input name="oneOfOne" type="checkbox" /> 1 of 1 — only one copy can ever be issued</label><button className="button button-primary">Add card</button></form>
      </section>
      <section className="admin-panel"><div className="panel-heading"><span>03</span><div><h2>Publish pack</h2><p>Weights are displayed as normalized percentages.</p></div></div>
        <form action={createPackAction} className="admin-form"><SearchableSelect name="setId" label="Card set" options={setOptions} searchPlaceholder="Search card sets…" /><label>Name<input name="name" required /></label><label>Description<textarea name="description" maxLength={300} /></label><div className="form-row"><label>Price<input min="1" name="price" type="number" required /></label><label>Cards per pack<input defaultValue="5" min="1" max="10" name="cardsPerPack" type="number" required /></label></div><div className="form-row"><label>Common<input defaultValue="70" min="0" name="commonWeight" type="number" /></label><label>Rare<input defaultValue="22" min="0" name="rareWeight" type="number" /></label></div><div className="form-row"><label>Epic<input defaultValue="7" min="0" name="epicWeight" type="number" /></label><label>Legendary<input defaultValue="1" min="0" name="legendaryWeight" type="number" /></label></div><label className="check-label"><input name="active" type="checkbox" /> Available for purchase</label><button className="button button-primary">Create pack</button></form>
      </section>
    </div>

    <section className="admin-panel catalog-manager"><div className="panel-heading"><span>04</span><div><h2>Catalog manager</h2><p>Edit any listing. Unused drafts can be deleted; issued collectible history is protected.</p></div></div>
      <h3>Sets</h3>
      {sets.map((set) => <details className="catalog-editor" key={set.id}><summary><span><strong>{set.code} · {set.name}</strong><small>{set._count.definitions} cards · {set._count.packs} packs</small></span><b>{set.active ? "ACTIVE" : "DRAFT"}</b></summary><form action={updateSetAction} className="admin-form"><input name="id" type="hidden" value={set.id} /><div className="form-row"><label>Name<input defaultValue={set.name} name="name" required /></label><label>Code<input defaultValue={set.code} maxLength={12} name="code" required /></label></div><label>Description<textarea defaultValue={set.description ?? ""} maxLength={500} name="description" /></label><label>Release time<input defaultValue={localDateTime(set.releasedAt)} name="releasedAt" type="datetime-local" required /></label><label className="check-label"><input defaultChecked={set.active} name="active" type="checkbox" /> Publicly active</label><button className="button button-primary">Save set</button></form><form action={deleteSetAction}><input name="id" type="hidden" value={set.id} /><button className="button button-danger" disabled={set._count.definitions > 0 || set._count.packs > 0}>Delete unused set</button></form></details>)}
      {!sets.length && <p>No sets created yet.</p>}

      <h3>Cards</h3>
      {cards.map((card) => <details className="catalog-editor" key={card.id}><summary><span><strong>{card.set.code} #{card.cardNumber} · {card.name}</strong><small>{card.rarity} · {card._count.instances} issued {card.maxSupply === 1 ? "· 1 OF 1" : ""}</small></span><b>{card.active ? "ACTIVE" : "INACTIVE"}</b></summary><form action={updateCardAction} className="admin-form"><input name="id" type="hidden" value={card.id} /><label>Card set<select defaultValue={card.setId} name="setId">{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.name}</option>)}</select></label><label>Linked fighter<select defaultValue={card.fighterId ?? ""} name="fighterId"><option value="">No fighter link</option>{fighters.map((fighter) => <option key={fighter.id} value={fighter.id}>#{fighter.rank ?? "Unranked"} {fighter.name}</option>)}</select></label><div className="form-row"><label>Name<input defaultValue={card.name} name="name" required /></label><label>Subtitle<input defaultValue={card.subtitle ?? ""} maxLength={120} name="subtitle" /></label></div><label>Existing HTTPS image URL<input defaultValue={card.imageUrl?.startsWith("https://") ? card.imageUrl : ""} name="imageUrl" placeholder={card.imageUrl?.startsWith("/") ? "Database image retained" : "https://..."} type="url" /></label><div className="form-row"><label>Rarity<select defaultValue={card.rarity} name="rarity">{rarities.map((rarity) => <option key={rarity}>{rarity}</option>)}</select></label><label>Card number<input defaultValue={card.cardNumber} min="1" max="9999" name="cardNumber" type="number" required /></label></div><label className="check-label"><input defaultChecked={card.maxSupply === 1} name="oneOfOne" type="checkbox" /> 1 of 1</label><label className="check-label"><input defaultChecked={card.active} name="active" type="checkbox" /> Available in packs</label><button className="button button-primary">Save card</button></form><form action={deleteCardAction}><input name="id" type="hidden" value={card.id} /><button className="button button-danger" disabled={card._count.instances > 0}>Delete unused card</button></form></details>)}
      {!cards.length && <p>No cards created yet.</p>}

      <h3>Packs</h3>
      {packs.map((pack) => <details className="catalog-editor" key={pack.id}><summary><span><strong>{pack.name}</strong><small>{pack.set.code} · {pack.cardsPerPack} cards · {pack._count.openings} openings · table v{pack.dropTableVersion}</small></span><b>{pack.active ? "ACTIVE" : "DRAFT"}</b></summary><form action={updatePackAction} className="admin-form"><input name="id" type="hidden" value={pack.id} /><label>Card set<select defaultValue={pack.setId} name="setId">{sets.map((set) => <option key={set.id} value={set.id}>{set.code} · {set.name}</option>)}</select></label><label>Name<input defaultValue={pack.name} name="name" required /></label><label>Description<textarea defaultValue={pack.description ?? ""} maxLength={300} name="description" /></label><div className="form-row"><label>Price<input defaultValue={pack.price} min="1" name="price" type="number" required /></label><label>Cards per pack<input defaultValue={pack.cardsPerPack} min="1" max="10" name="cardsPerPack" type="number" required /></label></div><div className="form-row"><label>Common<input defaultValue={pack.commonWeight} min="0" name="commonWeight" type="number" /></label><label>Rare<input defaultValue={pack.rareWeight} min="0" name="rareWeight" type="number" /></label></div><div className="form-row"><label>Epic<input defaultValue={pack.epicWeight} min="0" name="epicWeight" type="number" /></label><label>Legendary<input defaultValue={pack.legendaryWeight} min="0" name="legendaryWeight" type="number" /></label></div><label className="check-label"><input defaultChecked={pack.active} name="active" type="checkbox" /> Available for purchase</label><button className="button button-primary">Save pack</button></form><form action={deletePackAction}><input name="id" type="hidden" value={pack.id} /><button className="button button-danger" disabled={pack._count.openings > 0}>Delete unused pack</button></form></details>)}
      {!packs.length && <p>No packs created yet.</p>}
    </section>
  </main>;
}
