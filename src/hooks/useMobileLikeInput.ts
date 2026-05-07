'use client';

import { useEffect, useState } from 'react';

export default function useMobileLikeInput() {
  const [isMobileLike, setIsMobileLike] = useState(false);

  useEffect(() => {
    const smallScreenQuery = window.matchMedia('(max-width: 768px)');
    const coarsePointerQuery = window.matchMedia('(pointer: coarse)');
    const noHoverQuery = window.matchMedia('(hover: none)');

    const update = () => {
      setIsMobileLike(
        smallScreenQuery.matches ||
          coarsePointerQuery.matches ||
          noHoverQuery.matches,
      );
    };

    update();

    smallScreenQuery.addEventListener('change', update);
    coarsePointerQuery.addEventListener('change', update);
    noHoverQuery.addEventListener('change', update);

    return () => {
      smallScreenQuery.removeEventListener('change', update);
      coarsePointerQuery.removeEventListener('change', update);
      noHoverQuery.removeEventListener('change', update);
    };
  }, []);

  return isMobileLike;
}
