'use client';

import { CircleHelp, X } from 'lucide-react';
import { usePathname } from 'next/navigation';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { getGuideVideosForPath, type GuideVideo } from '@/lib/guide';

export default function HelpDrawer({ videos }: { videos: GuideVideo[] }) {
  const pathname = usePathname();
  const pageVideos = getGuideVideosForPath(videos, pathname);

  return (
    <Drawer direction='right'>
      <DrawerTrigger asChild>
        <Button
          variant='accent'
          size='icon'
          className='fixed right-6 bottom-6 z-40 size-12 rounded-full shadow-lg'
          aria-label='Abrir ayuda'
        >
          <CircleHelp className='size-6' />
        </Button>
      </DrawerTrigger>

      <DrawerContent className='w-full! sm:max-w-xl!'>
        <DrawerHeader className='relative border-b pr-12'>
          <DrawerTitle className='text-xl'>Ayuda</DrawerTitle>
          <DrawerDescription>
            Videos disponibles para esta pantalla
          </DrawerDescription>
          <DrawerClose asChild>
            <Button
              variant='ghost'
              size='icon'
              className='absolute top-3 right-3'
              aria-label='Cerrar ayuda'
            >
              <X />
            </Button>
          </DrawerClose>
        </DrawerHeader>

        <div className='flex-1 space-y-6 overflow-y-auto p-4'>
          {pageVideos.length ? (
            pageVideos.map((video) => (
              <article key={`${video.title}-${video.video.url}`}>
                <h2 className='mb-2 font-semibold'>{video.title}</h2>
                <div className='aspect-video overflow-hidden rounded-lg bg-black'>
                  {video.video.kind === 'embed' ? (
                    <iframe
                      src={video.video.url}
                      title={video.title}
                      className='size-full'
                      loading='lazy'
                      allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                      allowFullScreen
                    />
                  ) : (
                    <video
                      src={video.video.url}
                      className='size-full'
                      controls
                      preload='metadata'
                    />
                  )}
                </div>
              </article>
            ))
          ) : (
            <p className='text-muted-foreground text-sm'>
              Todavía no hay videos para esta pantalla.
            </p>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
