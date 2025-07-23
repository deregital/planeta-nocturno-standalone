'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TicketPurchaseModal from './TicketPurchaseModal';
import { type RouterOutputs } from '@/server/routers/app';
import { trpc } from '@/server/trpc/client';
import { useEventTickets } from '@/hooks/useEventTickets';
import ErrorModal from './ErrorModal';

function TicketPurchase({
  ticketTypes,
  eventId,
}: {
  ticketTypes: RouterOutputs['events']['getById']['ticketTypes'];
  eventId: string;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [ticketGroupId, setTicketGroupId] = useState<
    RouterOutputs['ticketGroup']['create']['id'] | null
  >(null);
  const {
    ticketsAvailable: ticketsTypeAvailable,
    quantity,
    setQuantity,
    isLoading,
  } = useEventTickets(eventId, ticketTypes);
  const createTicketGroup = trpc.ticketGroup.create.useMutation({
    onError: (error) => {
      setShowErrorModal(true);
      setErrorMessage(error.message);
    },
  });
  const deleteTicketGroup = trpc.ticketGroup.delete.useMutation();

  const handlePurchase = async () => {
    // if (quantity === '0') return;
    // if (ticketsAvailable < parseInt(quantity)) return;

    await createTicketGroup
      .mutateAsync({
        eventId,
        amountTickets: 0,
      })
      .then((ticketGroupData) => {
        setTicketGroupId(ticketGroupData.id);
      });

    setIsModalOpen(true);
  };

  const handleCloseModal = async (bought: boolean) => {
    setIsModalOpen(false);
    if (!bought && ticketGroupId) {
      await deleteTicketGroup.mutateAsync(ticketGroupId).then(() => {
        setTicketGroupId(null);
      });
    }
  };

  return (
    <div className='rounded-[20px] border border-MiExpo_gray p-6 bg-white h-full flex flex-col font-sans'>
      {/* Encabezado de la tabla */}
      <div className='grid grid-cols-3 pb-2 border-b border-MiExpo_gray'>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%]'>
          Tipo de Ticket
        </div>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-center'>
          Valor
        </div>
        <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-right'>
          Cantidad
        </div>
      </div>

      {/* Fila de ticket */}
      <div className='grid grid-cols-3 py-4 gap-2 items-center'>
        {ticketsTypeAvailable.map((type, index) => {
          return (
            <React.Fragment key={index}>
              <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%]'>
                {type.name}
              </div>
              <div className='text-MiExpo_black text-[12px] sm:text-[16px] font-normal leading-[100%] text-center'>
                {type.price ? (
                  <p>${type.price}</p>
                ) : (
                  <p className='text-green-700'>GRATUITO</p>
                )}
              </div>
              <div className='flex justify-end'>
                {!type.disabled ? (
                  <Select
                    value={quantity
                      .find((q) => q.ticketTypeId === type.id)!
                      .amount.toString()}
                    onValueChange={(value) =>
                      setQuantity([
                        ...quantity.filter((q) => q.ticketTypeId !== type.id),
                        { ticketTypeId: type.id, amount: parseInt(value) },
                      ])
                    }
                  >
                    <SelectTrigger className='w-24 bg-white text-MiExpo_black border border-MiExpo_gray'>
                      <SelectValue placeholder='0' />
                    </SelectTrigger>
                    <SelectContent align='end'>
                      {[...Array(type.maxPerPurchase + 1).keys()]
                        .map((i) => i)
                        .map((num) => (
                          <SelectItem key={num} value={num.toString()}>
                            {num.toString()}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className='text-red-500 font-medium text-[12px] sm:text-[16px]'>
                    Entradas agotadas!
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Botón de compra */}
      <div className='mt-4 grid grid-cols-3'>
        <Button
          className={`bg-purple-700 cursor-pointer col-span-1 hover:bg-MiExpo_purple/90 text-white font-medium text-[12px] sm:text-[16px] leading-[100%] px-8 py-2 rounded-[10px] ${
            !ticketsTypeAvailable
              ? 'opacity-50 cursor-not-allowed bg-red-500'
              : ''
          }`}
          onClick={handlePurchase}
          disabled={
            ticketsTypeAvailable.every((ticket) => ticket.disabled) || isLoading
          }
        >
          {ticketsTypeAvailable ? 'COMPRAR' : 'AGOTADO'}
        </Button>
      </div>

      {/* Modal de compra de tickets */}
      <TicketPurchaseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        quantity={'0'}
        isFree={true}
        eventId={eventId}
        ticketType={'ticketTypes[0].name'}
        ticketGroupId={ticketGroupId || ''}
      />
      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        errorTitle={'No se pudo reservar los tickets'}
        errorMessage={errorMessage}
      />
    </div>
  );
}

export default TicketPurchase;
