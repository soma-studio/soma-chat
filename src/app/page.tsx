import { fetchServiceData } from '@/lib/cms-data'
import { ChatbotPage } from '@/components/ChatbotPage'

export default async function Home() {
  const { features, howItWorks, faq } = await fetchServiceData()

  return (
    <ChatbotPage
      features={features}
      howItWorks={howItWorks}
      faq={faq}
    />
  )
}
