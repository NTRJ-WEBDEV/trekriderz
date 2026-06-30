const CHUNK_SIZE = 400; // MyMemory free tier: 500 chars/request

function splitIntoChunks(text: string): string[] {
  if (text.length <= CHUNK_SIZE) return [text];

  const chunks: string[] = [];
  // Split on sentence boundaries (English + Indian script punctuation)
  const sentences = text.split(/(?<=[.!?।\n])\s*/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > CHUNK_SIZE) {
      if (current.trim()) chunks.push(current.trim());
      // If a single sentence exceeds limit, hard-split it
      if (sentence.length > CHUNK_SIZE) {
        for (let i = 0; i < sentence.length; i += CHUNK_SIZE) {
          chunks.push(sentence.slice(i, i + CHUNK_SIZE));
        }
        current = '';
      } else {
        current = sentence;
      }
    } else {
      current += (current ? ' ' : '') + sentence;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

export async function translateText(text: string, toLang = 'en'): Promise<string | null> {
  if (!text?.trim()) return null;
  try {
    const chunks = splitIntoChunks(text);
    const results = await Promise.all(
      chunks.map(async (chunk) => {
        const url =
          `https://api.mymemory.translated.net/get` +
          `?q=${encodeURIComponent(chunk)}&langpair=auto|${toLang}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return chunk;
        const json = await res.json();
        return (json.responseData?.translatedText as string) ?? chunk;
      })
    );
    return results.join(' ');
  } catch {
    return null;
  }
}
