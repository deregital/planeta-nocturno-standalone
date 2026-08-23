import 'server-only';

import { z } from 'zod';

import { type GuideVideo } from '@/lib/guide';

const guideRoleByUserRole: Record<string, string> = {
  ADMIN: 'administrador',
  CHIEF_ORGANIZER: 'jefe-organizadores',
  ORGANIZER: 'organizadores',
  TICKETING: 'acceso',
  CONTROL_TICKETING: 'acceso',
};

const guideVideosSchema = z.array(
  z.object({
    title: z.string(),
    video: z.object({
      kind: z.enum(['embed', 'file']),
      url: z.string().url(),
    }),
    pages: z.array(z.string()),
    role: z.object({
      id: z.string(),
      label: z.string(),
      slug: z.string(),
    }),
  }),
);

export async function getGuideVideos(userRole: string): Promise<GuideVideo[]> {
  const guideUrl = process.env.GUIDE_URL?.trim();
  const guideRole = guideRoleByUserRole[userRole];
  if (!guideUrl || !guideRole) return [];

  try {
    const endpoint = new URL(
      'api/videos.json',
      `${guideUrl.replace(/\/+$/, '')}/`,
    );
    const response = await fetch(endpoint, {
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) throw new Error(`Guide responded ${response.status}`);

    const videos = guideVideosSchema.parse(await response.json());
    return videos.filter((video) => video.role.id === guideRole);
  } catch (error) {
    console.error('Unable to load guide videos', error);
    return [];
  }
}
