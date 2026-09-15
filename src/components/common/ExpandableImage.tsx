'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils';

type OriginRect = { top: number; left: number; width: number; height: number };

function readRect(el: HTMLElement): OriginRect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

function getExpandedRect(origin: OriginRect, maxSize: number): OriginRect {
  const maxW = Math.min(window.innerWidth * 0.9, maxSize);
  const maxH = Math.min(window.innerHeight * 0.8, maxSize);
  const aspect = origin.width / (origin.height || 1);

  let width = maxW;
  let height = width / aspect;
  if (height > maxH) {
    height = maxH;
    width = height * aspect;
  }

  return {
    width,
    height,
    left: (window.innerWidth - width) / 2,
    top: (window.innerHeight - height) / 2,
  };
}

export function ExpandableImage({
  src,
  alt,
  className,
  imageClassName,
  sizes,
  priority,
  maxExpandedSize = 576,
  'aria-label': ariaLabel,
}: {
  src: string;
  alt: string;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  priority?: boolean;
  maxExpandedSize?: number;
  'aria-label'?: string;
}) {
  const thumbRef = useRef<HTMLButtonElement>(null);
  const originRef = useRef<OriginRect>({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
  });
  const originRadiusRef = useRef('0px');
  const [active, setActive] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const captureOrigin = () => {
    const el = thumbRef.current;
    if (!el) return false;
    originRef.current = readRect(el);
    originRadiusRef.current = getComputedStyle(el).borderRadius || '0px';
    return true;
  };

  const openLightbox = () => {
    if (!captureOrigin()) return;
    setActive(true);
    setExpanded(false);
  };

  const closeLightbox = () => {
    captureOrigin();
    setExpanded(false);
  };

  useEffect(() => {
    if (!active) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setExpanded(true));
    });
    return () => cancelAnimationFrame(id);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [active]);

  const box = expanded
    ? getExpandedRect(originRef.current, maxExpandedSize)
    : originRef.current;

  return (
    <>
      <button
        ref={thumbRef}
        type='button'
        onClick={openLightbox}
        aria-label={ariaLabel ?? `Ver imagen ampliada: ${alt}`}
        className={cn(
          'cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          className,
        )}
        style={{ opacity: active ? 0 : 1 }}
      >
        <Image
          fill
          src={src}
          alt={alt}
          priority={priority}
          sizes={sizes}
          className={cn('object-cover', imageClassName)}
        />
      </button>
      {active
        ? createPortal(
            <div
              role='dialog'
              aria-modal='true'
              aria-label={alt}
              className='fixed inset-0 z-50'
            >
              <button
                type='button'
                aria-label='Cerrar imagen'
                className='absolute inset-0 bg-black/60 transition-opacity duration-200'
                style={{ opacity: expanded ? 1 : 0 }}
                onClick={closeLightbox}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={alt}
                onTransitionEnd={(e) => {
                  if (e.propertyName !== 'width') return;
                  if (!expanded) setActive(false);
                }}
                className='fixed z-10 object-cover shadow-lg transition-[top,left,width,height,border-radius] duration-200 ease-out'
                style={{
                  top: box.top,
                  left: box.left,
                  width: box.width,
                  height: box.height,
                  borderRadius: expanded ? '12px' : originRadiusRef.current,
                }}
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
