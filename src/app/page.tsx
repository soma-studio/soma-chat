import type { Metadata } from 'next'
import { fetchServiceData } from '@/lib/cms-data'
import { ChatbotPage } from '@/components/ChatbotPage'

export const metadata: Metadata = {
  title: 'Chatbot IA gratuit pour votre site web | SOMA Studio',
  description:
    'Ajoutez un chatbot IA à votre site en 5 minutes. Scraping automatique, indexation vectorielle Mistral AI, widget embeddable en une ligne de code. Gratuit, open source (MIT).',
  keywords: [
    'chatbot IA gratuit',
    'chatbot site web',
    'RAG chatbot',
    'widget chatbot',
    'Mistral AI',
    'chatbot open source',
    'SOMA Studio',
    'chatbot français',
    'assistant IA site web',
    'indexation vectorielle',
  ],
  authors: [{ name: 'SOMA Studio', url: 'https://somastudio.xyz' }],
  openGraph: {
    title: 'Chatbot IA gratuit pour votre site web — SOMA Studio',
    description:
      'Ajoutez un chatbot IA à votre site en 5 minutes. Scraping automatique, indexation vectorielle, widget embeddable. Gratuit, open source.',
    url: 'https://chatbot.somastudio.xyz',
    siteName: 'SOMA Studio',
    locale: 'fr_FR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Chatbot IA gratuit | SOMA Studio',
    description:
      'Ajoutez un chatbot IA à votre site en 5 minutes. Gratuit, open source.',
  },
  alternates: {
    canonical: 'https://chatbot.somastudio.xyz',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-snippet': -1,
      'max-image-preview': 'large',
    },
  },
}

export default async function Home() {
  const { features, howItWorks, faq } = await fetchServiceData()

  const softwareAppSchema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Chatbot IA gratuit — SOMA Studio',
    description:
      'Ajoutez un chatbot IA à votre site en 5 minutes. Scraping automatique, indexation vectorielle Mistral AI, widget embeddable.',
    url: 'https://chatbot.somastudio.xyz',
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    license: 'https://opensource.org/licenses/MIT',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'EUR',
      description: 'Gratuit · 10 pages indexées',
    },
    author: {
      '@type': 'Organization',
      name: 'SOMA Studio',
      url: 'https://somastudio.xyz',
    },
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'SOMA Studio',
        item: 'https://somastudio.xyz',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Nos services',
        item: 'https://somastudio.xyz/nos-services',
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: 'Chatbot IA gratuit',
        item: 'https://chatbot.somastudio.xyz',
      },
    ],
  }

  const howToSchema = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'Comment ajouter un chatbot IA à votre site web',
    description:
      'Ajoutez un chatbot intelligent à votre site en 3 étapes simples.',
    step: howItWorks.map((s, i) => ({
      '@type': 'HowToStep',
      position: i + 1,
      name: s.stepTitle,
      text: s.stepDescription,
    })),
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map((item) => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareAppSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(howToSchema),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqSchema),
        }}
      />
      <ChatbotPage features={features} howItWorks={howItWorks} faq={faq} />
    </>
  )
}
