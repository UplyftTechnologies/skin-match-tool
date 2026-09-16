// Reads newline-delimited JSON even when a network chunk splits a UTF-8 character.
export async function readPriceStream(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const consume = () => {
    let newline;
    while ((newline = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (line) onEvent(JSON.parse(line));
    }
  };
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > 100000) throw new Error('Price response too large');
      consume();
    }
    buffer += decoder.decode();
    if (buffer.trim()) onEvent(JSON.parse(buffer));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
