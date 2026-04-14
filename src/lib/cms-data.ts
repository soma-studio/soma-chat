export interface CMSFeature {
  id?: string | null
  feature: string
}

export interface CMSStep {
  id?: string | null
  stepTitle: string
  stepDescription: string
  stepIcon?: string | null
}

export interface CMSFaqItem {
  id?: string | null
  question: string
  answer: string
}

export interface CMSServiceData {
  features: CMSFeature[]
  howItWorks: CMSStep[]
  faq: CMSFaqItem[]
}

// Fallback data — used when Payload API is unreachable
export const FALLBACK_FEATURES: CMSFeature[] = [
  { feature: 'Scraping automatique de votre site (pages publiques)' },
  { feature: 'Découpage intelligent du contenu en chunks' },
  { feature: 'Indexation vectorielle via Mistral AI embeddings' },
  { feature: 'Chatbot RAG avec réponses sourcées' },
  { feature: 'Widget embeddable en une ligne de code (Shadow DOM)' },
  { feature: 'Questions suggérées auto-générées' },
  { feature: 'Aucune clé API requise. Tout est hébergé' },
  { feature: 'Open source (MIT). Self-host possible' },
]

export const FALLBACK_STEPS: CMSStep[] = [
  {
    stepTitle: 'Entrez votre URL',
    stepDescription:
      "On prend l\u2019URL de votre site et on crawle toutes les pages publiques.",
  },
  {
    stepTitle: 'On indexe votre contenu',
    stepDescription:
      'Le contenu est découpé en chunks, transformé en vecteurs et stocké dans Qdrant.',
  },
  {
    stepTitle: 'Collez le script',
    stepDescription:
      'Un simple <script> à ajouter dans votre HTML. Le chatbot apparaît en bas à droite.',
  },
]

export const FALLBACK_FAQ: CMSFaqItem[] = [
  {
    question: 'Quels types de sites sont compatibles ?',
    answer:
      'Tous les sites avec du contenu HTML public : sites vitrines, blogs, e-commerce, documentation technique. Le scraper extrait automatiquement le texte, les titres, les tableaux et les données structurées (JSON-LD). Les sites construits avec Webflow, WordPress, Shopify, Next.js ou du HTML statique sont tous pris en charge.',
  },
  {
    question: 'Le chatbot peut-il répondre dans plusieurs langues ?',
    answer:
      "Oui. Le modèle IA (Mistral) est multilingue. Le chatbot détecte automatiquement la langue de votre site et répond dans la même langue. Si votre site est en français, les réponses seront en français. Si vous avez du contenu en anglais, il répondra en anglais.",
  },
  {
    question: 'Mes données sont-elles en sécurité ?',
    answer:
      "Le chatbot n'indexe que le contenu public de votre site — les mêmes pages que Google peut voir. Aucune donnée privée, aucun formulaire, aucune zone authentifiée n'est scrappée. Les embeddings vectoriels sont stockés sur Qdrant Cloud (AWS eu-west-1). Le code est open source (MIT), vous pouvez auditer chaque ligne.",
  },
  {
    question: 'Que se passe-t-il après 10 pages ?',
    answer:
      "Le free tier indexe les 10 premières pages de votre site. Pour la plupart des sites vitrines, c'est suffisant pour couvrir les pages principales (accueil, services, à propos, contact, FAQ). Si votre site a plus de contenu, nous proposons des assistants IA sur mesure sans limite de pages.",
  },
  {
    question: "Puis-je personnaliser l'apparence du chatbot ?",
    answer:
      "Vous pouvez changer la couleur d'accent via l'attribut data-color sur le script. Le widget utilise le Shadow DOM pour l'isolation CSS. Il ne sera jamais affecté par le style de votre site, et ne modifiera jamais le vôtre.",
  },
]

const PAYLOAD_API_URL = 'https://somastudio.xyz/api/services'

export async function fetchServiceData(): Promise<CMSServiceData> {
  const url = `${PAYLOAD_API_URL}?where%5Bslug%5D%5Bequals%5D=chatbot-ia&depth=1`
  try {
    const res = await fetch(url, {
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) throw new Error(`API returned ${res.status}`)

    const data = await res.json()
    const service = data.docs?.[0]

    if (!service) throw new Error('Service not found')

    return {
      features:
        service.features?.length > 0 ? service.features : FALLBACK_FEATURES,
      howItWorks:
        service.howItWorks?.length > 0
          ? service.howItWorks
          : FALLBACK_STEPS,
      faq: service.faq?.length > 0 ? service.faq : FALLBACK_FAQ,
    }
  } catch (err) {
    console.error(
      '[CMS] Failed to fetch service data:',
      err instanceof Error ? err.message : String(err),
    )
    return {
      features: FALLBACK_FEATURES,
      howItWorks: FALLBACK_STEPS,
      faq: FALLBACK_FAQ,
    }
  }
}
