'use client';

import type { Area } from 'react-easy-crop';

import { useCallback, useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import 'react-easy-crop/react-easy-crop.css';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { getCroppedImageBlob } from '@/lib/image-crop';

type EventCoverSquareCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string | null;
  originalFileName: string;
  onConfirm: (file: File) => void;
};

export function EventCoverSquareCropDialog({
  open,
  onOpenChange,
  imageSrc,
  originalFileName,
  onConfirm,
}: EventCoverSquareCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  useEffect(() => {
    if (open && imageSrc) {
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    }
  }, [open, imageSrc]);

  const onCropComplete = useCallback((_: Area, pixels: Area) => {
    setCroppedAreaPixels(pixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !croppedAreaPixels) return;
    setIsWorking(true);
    try {
      const blob = await getCroppedImageBlob(
        imageSrc,
        croppedAreaPixels,
        'image/jpeg',
        0.92,
      );
      const base =
        originalFileName.replace(/\.[^.]+$/i, '').trim() || 'portada';
      const file = new File([blob], `${base}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });
      onConfirm(file);
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='max-h-[90vh] overflow-y-auto sm:max-w-xl'
        showCloseButton={!isWorking}
        onPointerDownOutside={(e) => {
          if (isWorking) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isWorking) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Recortar portada</DialogTitle>
          <DialogDescription>
            Mové y ampliá la imagen hasta tener el encuadre deseado. La portada
            del evento se guarda en relación 1:1.
          </DialogDescription>
        </DialogHeader>

        {imageSrc ? (
          <div className='space-y-4'>
            <div className='relative h-72 w-full overflow-hidden rounded-md bg-black'>
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                objectFit='contain'
                minZoom={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
                restrictPosition
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='cover-crop-zoom'>Zoom</Label>
              <Slider
                id='cover-crop-zoom'
                min={1}
                max={3}
                step={0.02}
                value={[zoom]}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
                disabled={isWorking}
              />
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button
            type='button'
            variant='ghost'
            disabled={isWorking}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type='button'
            disabled={!croppedAreaPixels || !imageSrc || isWorking}
            onClick={() => void handleConfirm()}
          >
            {isWorking ? 'Procesando…' : 'Usar recorte'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
