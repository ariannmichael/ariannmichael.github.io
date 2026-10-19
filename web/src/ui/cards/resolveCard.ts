import { getContent, links, profile } from "@/content";
import type { Game, Job, Links, Profile } from "@/content/types";

// Everything an info card can show. Jobs and games come from content; "about", "contact" and "cv"
// are fixed marker ids in the world (see ActiveZone in useAppStore) rendered from profile/links.
export type CardData =
  | { type: "job"; job: Job }
  | { type: "game"; game: Game }
  | { type: "about"; profile: Profile; links: Links }
  | { type: "contact"; profile: Profile; links: Links }
  | { type: "cv"; profile: Profile; links: Links };

export function resolveCard(id: string): CardData | undefined {
  if (id === "about") return { type: "about", profile, links };
  if (id === "contact") return { type: "contact", profile, links };
  if (id === "cv") return { type: "cv", profile, links };
  const content = getContent(id);
  if (!content) return undefined;
  return content.type === "job" ? { type: "job", job: content.item } : { type: "game", game: content.item };
}

/** Short title for prompts ("Press E to open · <title>"). */
export function cardTitle(card: CardData): string {
  switch (card.type) {
    case "job":
      return card.job.client ? `${card.job.company} for ${card.job.client}` : card.job.company;
    case "game":
      return card.game.title;
    case "about":
      return "About me";
    case "contact":
      return "Contact";
    case "cv":
      return "Résumé (CV)";
  }
}
