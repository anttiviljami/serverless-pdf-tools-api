import fetch from 'node-fetch';

export async function fetchBuffer(url: string) {
  try {
    const res = await fetch(url);

    // Check if we were able to fetch the resource.
    if (!res.ok) {
      throw new Error(`Could not fetch ${url}: ${res.statusText}`);
    }

    return res.buffer();
  } catch (e) {
    throw new Error(`Could not fetch ${url}: ${e.message}`);
  }
}
