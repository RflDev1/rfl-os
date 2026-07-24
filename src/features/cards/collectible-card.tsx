import Link from "next/link";

export type CollectibleCardData = { id?: string; name: string; subtitle?: string | null; rarity: string; serialNumber?: number; setCode: string; cardNumber: number; imageUrl?: string | null };

export function CollectibleCard({ card, revealed = true }: { card: CollectibleCardData; revealed?: boolean }) {
  const content = <div className={`collectible-card rarity-${card.rarity.toLowerCase()} ${revealed ? "revealed" : "concealed"}`}><div className="card-foil" /><header><span>{card.setCode} · {String(card.cardNumber).padStart(3, "0")}</span><b>{card.rarity}</b></header><div className={`card-portrait ${card.imageUrl ? "card-portrait-image" : ""}`} style={card.imageUrl ? { backgroundImage: `url("${card.imageUrl.replaceAll('"', "%22")}")` } : undefined}>{!card.imageUrl && <><strong>{card.name[0]}</strong><span>RFL</span></>}</div><div className="card-identity"><small>{card.subtitle ?? "Realm Fighter"}</small><h3>{card.name}</h3>{card.serialNumber && <b>Serial #{String(card.serialNumber).padStart(6, "0")}</b>}</div></div>;
  return card.id ? <Link className="collectible-card-link" href={`/cards/${card.id}`}>{content}</Link> : content;
}
