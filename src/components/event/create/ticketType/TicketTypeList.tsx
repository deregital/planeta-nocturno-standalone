import { GripVertical } from 'lucide-react';

import { type EventState } from '@/app/(backoffice)/admin/event/create/state';
import DeleteTicketTypeModal from '@/components/event/create/ticketType/DeleteTicketTypeModal';
import TicketTypeModal from '@/components/event/create/ticketType/TicketTypeModal';
import TicketTypeOrganizersModal from '@/components/event/create/ticketType/TicketTypeOrganizersModal';
import { useSortableList } from '@/hooks/useSortableList';
import { ticketTypesTranslation } from '@/lib/translations';
import { cn } from '@/lib/utils';
import { ORGANIZER_TICKET_TYPE_NAME } from '@/server/utils/constants';

export default function TicketTypeList({
  ticketTypes,
  maxAvailableLeft,
  action,
  onReorder,
}: {
  ticketTypes: EventState['ticketTypes'];
  maxAvailableLeft: number;
  action: 'PREVIEW' | 'EDIT';
  onReorder?: (activeId: string, overId: string) => void;
}) {
  const { draggedId, hoveredId, getItemProps } = useSortableList({
    items: ticketTypes
      .filter((type) => Boolean(type.id))
      .map((type) => ({ ...type, id: type.id! })),
    onReorder,
    isEnabled: (item) =>
      action === 'EDIT' &&
      item.name.trim() !== ORGANIZER_TICKET_TYPE_NAME.trim(),
  });

  return ticketTypes.length === 0 ? (
    <div className='flex justify-center'>
      <p className='text-xl font-extralight'>Todavía no hay tickets creados</p>
    </div>
  ) : (
    <ul className='gap-y-2 flex flex-col'>
      {action === 'PREVIEW' && (
        // En el celular no entran 5 columnas: cada fila muestra sus propias
        // etiquetas (abajo) y este encabezado sólo aparece desde sm.
        <li className='hidden sm:grid sm:grid-cols-5 font-bold text-accent border-stroke px-5'>
          <p>Nombre</p>
          <p>Descripción</p>
          <p>Precio</p>
          <p>Emisión máxima</p>
          <p>Max. por compra</p>
        </li>
      )}
      {ticketTypes.map((type, index) => {
        const { text } = ticketTypesTranslation[type.category];
        const isOrganizerTicketType =
          type.name.trim() === ORGANIZER_TICKET_TYPE_NAME.trim();
        const isReorderEnabled = action === 'EDIT' && !isOrganizerTicketType;

        return (
          <li
            key={type.id ?? `${type.name}-${index}`}
            {...(type.id
              ? getItemProps({ ...type, id: type.id })
              : { draggable: false })}
            className={cn(
              `border border-stroke rounded-md grid gap-2 items-center px-5 min-h-10`,
              action === 'EDIT'
                ? 'grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-5 py-2 [&>p]:min-w-0 [&>p]:break-words',
              draggedId === type.id ? 'opacity-60' : '',
              hoveredId === type.id && draggedId !== type.id
                ? 'ring-2 ring-accent/40'
                : '',
            )}
          >
            <p
              className={cn(
                'flex min-w-0 items-center gap-2',
                action === 'PREVIEW' &&
                  'col-span-2 font-medium sm:col-span-1 sm:font-normal',
              )}
            >
              {isReorderEnabled && (
                <GripVertical className='size-4 shrink-0 text-muted-foreground' />
              )}
              <span className='min-w-0 break-words'>{type.name}</span>
            </p>
            <p className={`${action === 'EDIT' && 'justify-self-center'}`}>
              {text}
            </p>
            {action === 'EDIT' ? (
              <div className='justify-self-end'>
                {!isOrganizerTicketType && (
                  <>
                    <TicketTypeOrganizersModal ticketType={type} />
                    <TicketTypeModal
                      action='EDIT'
                      maxAvailableLeft={maxAvailableLeft}
                      key={type.id}
                      category={type.category}
                      ticketType={type}
                    />
                    <DeleteTicketTypeModal id={type.id!} />
                  </>
                )}
              </div>
            ) : (
              <>
                <p>
                  <span className='text-muted-foreground sm:hidden'>
                    Precio:{' '}
                  </span>
                  ${type.price}
                </p>
                <p>
                  <span className='text-muted-foreground sm:hidden'>
                    Emisión máxima:{' '}
                  </span>
                  {type.maxAvailable} tickets
                </p>
                <p>
                  <span className='text-muted-foreground sm:hidden'>
                    Máx. por compra:{' '}
                  </span>
                  {type.maxPerPurchase} tickets
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
