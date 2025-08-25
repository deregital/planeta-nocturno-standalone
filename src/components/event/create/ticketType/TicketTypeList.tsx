import { ticketTypesTranslation } from '@/lib/translations';
import { type EventState } from '@/app/admin/event/create/state';
import DeleteTicketTypeModal from '@/components/event/create/ticketType/DeleteTicketTypeModal';
import TicketTypeModal from '@/components/event/create/ticketType/TicketTypeModal';

export default function TicketTypeList({
  ticketTypes,
  maxAvailableLeft,
  action,
}: {
  ticketTypes: EventState['ticketTypes'];
  maxAvailableLeft: number;
  action: 'PREVIEW' | 'EDIT';
}) {
  return ticketTypes.length === 0 ? (
    <div className='flex justify-center'>
      <p className='text-xl font-extralight'>Todavía no hay entradas creadas</p>
    </div>
  ) : (
    <ul>
      {action === 'PREVIEW' && (
        <li className='grid grid-cols-5 border font-bold'>
          <p>Nombre</p>
          <p>Descripción</p>
          <p>Precio</p>
          <p>Emisión máxima</p>
          <p>Max. por compra</p>
        </li>
      )}
      {ticketTypes.map((type, index) => {
        const { text } = ticketTypesTranslation[type.category];

        return (
          <li
            key={index}
            className={`border grid gap-2 items-center ${action === 'EDIT' ? 'grid-cols-3' : 'grid-cols-5 py-2'}`}
          >
            <p>{type.name}</p>
            <p className={`${action === 'EDIT' && 'justify-self-center'}`}>
              {text}
            </p>
            {action === 'EDIT' ? (
              <div className='justify-self-end'>
                <TicketTypeModal
                  action='EDIT'
                  maxAvailableLeft={maxAvailableLeft}
                  key={type.id}
                  category={type.category}
                  ticketType={type}
                />
                <DeleteTicketTypeModal id={type.id!} />
              </div>
            ) : (
              <>
                <p>${type.price}</p>
                <p>{type.maxAvailable} tickets</p>
                <p>{type.maxPerPurchase} tickets</p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}
