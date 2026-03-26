import { chatCompletion } from "./mistral";
import type { SiteProfile, ScrapedPage } from "@/types";

/**
 * Analyzes scraped content to build an intelligent site profile.
 * This profile gives the chatbot contextual understanding of the site.
 */
export async function analyzeSite(
  pages: ScrapedPage[],
  siteUrl: string
): Promise<SiteProfile> {
  // Concatenate all page content (truncate to ~8000 chars to fit context)
  const contentSummary = pages
    .map((p) => `=== ${p.title} ===\n${p.content}`)
    .join("\n\n")
    .slice(0, 8000);

  const prompt = `Tu es un analyste expert. Analyse le contenu de ce site web et retourne un profil JSON structuré.

URL du site : ${siteUrl}

CONTENU DU SITE :
${contentSummary}

Retourne UNIQUEMENT un objet JSON valide (pas de markdown, pas de backticks, pas d'explication) avec cette structure exacte :

{
  "businessType": "type d'activité en 3-5 mots (ex: Hôtel 2 étoiles, Cabinet d'avocats spécialisé droit des affaires, Restaurant gastronomique)",
  "businessName": "nom commercial exact tel qu'il apparaît sur le site",
  "location": "ville ou région si mentionnée, sinon chaîne vide",
  "keyFacts": ["5 à 8 faits clés extraits du contenu : tarifs, horaires, services, spécialités, équipe, etc."],
  "tone": "description du ton à adopter pour représenter ce site (ex: Professionnel et rassurant, Chaleureux et familial, Expert et pédagogue)",
  "persona": "description en une phrase du personnage que le chatbot doit incarner (ex: Un concierge attentionné qui connaît chaque recoin de l'hôtel)",
  "summary": "résumé de 2-3 phrases décrivant l'activité, ses points forts et son positionnement — ce résumé sera injecté dans le prompt système du chatbot",
  "suggestedQuestions": ["exactement 4 questions que les visiteurs du site poseraient naturellement, basées sur le contenu réel (pas de questions génériques)"]
}

RÈGLES :
- keyFacts : extrais des DONNÉES CONCRÈTES du contenu (prix, horaires, noms, chiffres). Pas de généralités.
- suggestedQuestions : les questions doivent refléter ce que le contenu peut RÉELLEMENT répondre. Si le site a des tarifs, pose une question sur les tarifs. Si le site a un menu, pose une question sur le menu.
- tone : analyse le style d'écriture du site pour déterminer le ton.
- persona : le chatbot doit avoir une personnalité cohérente avec le site.
- Tout en français sauf si le site est clairement anglophone.`;

  try {
    const response = await chatCompletion(prompt, "Analyse ce site et retourne le JSON.");

    // Parse JSON — handle potential markdown wrapping
    const cleaned = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const profile = JSON.parse(cleaned) as SiteProfile;

    // Validate required fields
    if (!profile.businessType || !profile.businessName || !profile.summary) {
      throw new Error("Missing required profile fields");
    }

    // Ensure suggestedQuestions has exactly 4 items
    profile.suggestedQuestions = (profile.suggestedQuestions || []).slice(0, 4);
    if (profile.suggestedQuestions.length === 0) {
      profile.suggestedQuestions = ["Quels services proposez-vous ?"];
    }

    return profile;
  } catch (err) {
    console.error("Site analysis failed:", err);
    // Return a minimal fallback profile
    let siteName: string;
    try {
      siteName = new URL(siteUrl).hostname.replace("www.", "");
    } catch {
      siteName = siteUrl;
    }
    return {
      businessType: "Site web",
      businessName: siteName,
      location: "",
      keyFacts: [],
      tone: "Professionnel et bienveillant",
      persona: `L'assistant du site ${siteName}`,
      summary: `Assistant IA pour le site ${siteName}.`,
      suggestedQuestions: ["Quels services proposez-vous ?"],
    };
  }
}
