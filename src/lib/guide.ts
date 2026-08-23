export type GuideVideo = {
  title: string;
  video: {
    kind: 'embed' | 'file';
    url: string;
  };
  pages: string[];
  role: {
    id: string;
    label: string;
    slug: string;
  };
};

export function getGuideVideosForPath(videos: GuideVideo[], pathname: string) {
  const currentPath = normalizePath(pathname);
  const hasExactMatch = videos.some((video) =>
    video.pages.some((page) => normalizePath(page) === currentPath),
  );

  return videos.filter((video) =>
    video.pages.some((page) => {
      const guidePath = normalizePath(page);
      if (guidePath === currentPath) return true;
      return !hasExactMatch && matchesDynamicPath(guidePath, currentPath);
    }),
  );
}

function matchesDynamicPath(pattern: string, pathname: string) {
  const patternSegments = pattern.split('/').filter(Boolean);
  const pathSegments = pathname.split('/').filter(Boolean);

  return (
    patternSegments.length === pathSegments.length &&
    patternSegments.every(
      (segment, index) =>
        (segment.startsWith('[') && segment.endsWith(']')) ||
        segment === pathSegments[index],
    )
  );
}

function normalizePath(pathname: string) {
  return pathname !== '/' ? pathname.replace(/\/+$/, '') : pathname;
}
