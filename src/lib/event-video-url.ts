const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'www.youtube-nocookie.com',
]);

function getYouTubeVideoId(pathname: string, searchParams: URLSearchParams) {
  if (pathname.startsWith('/embed/')) {
    return pathname.split('/')[2] ?? null;
  }

  if (pathname.startsWith('/shorts/')) {
    return pathname.split('/')[2] ?? null;
  }

  return searchParams.get('v');
}

export function parseVideoEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());

    if (parsed.protocol !== 'https:') {
      return null;
    }

    if (parsed.hostname === 'youtu.be') {
      const videoId = parsed.pathname.split('/').filter(Boolean)[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    if (YOUTUBE_HOSTS.has(parsed.hostname)) {
      const videoId = getYouTubeVideoId(parsed.pathname, parsed.searchParams);
      return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function isSupportedEventVideoUrl(url: string): boolean {
  return parseVideoEmbedUrl(url) !== null;
}
