const MISTRAL_API_URL = "https://api.mistral.ai/v1";

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${MISTRAL_API_URL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-embed",
      input: [text],
    }),
  });

  if (!res.ok) {
    throw new Error(`Mistral Embed error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.data[0].embedding;
}

export async function chatCompletion(
  systemPrompt: string,
  userMessage: string
): Promise<string> {
  const res = await fetch(`${MISTRAL_API_URL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.MISTRAL_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral-small-latest",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    }),
  });

  if (!res.ok) {
    throw new Error(`Mistral Chat error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
