'use client';

import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { type TicketType } from '@/server/types';
import { type RouterOutputs } from '@/server/routers/app';

interface SearchTicketsProps {
  tickets: RouterOutputs['emittedTickets']['getByEventId'] | undefined;
  ticketTypes: TicketType[];
  onSearchResult: (
    highlightedTicketId: string | null,
    targetTab: string | null,
  ) => void;
}

export function SearchTickets({
  tickets,
  ticketTypes,
  onSearchResult,
}: SearchTicketsProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Search function to find tickets by nombre, DNI, email, or telefono
  const searchTickets = useCallback(
    (searchValue: string) => {
      if (!searchValue.trim() || !tickets) {
        onSearchResult(null, null);
        return;
      }

      const searchLower = searchValue
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      // Find the first matching ticket across all ticket types
      const matchingTicket = tickets.find((ticket) => {
        const fullName =
          ticket.fullName
            ?.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        const dni =
          ticket.dni
            ?.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        const mail =
          ticket.mail
            ?.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';
        const phoneNumber =
          ticket.phoneNumber
            ?.toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') || '';

        return (
          fullName.includes(searchLower) ||
          dni.includes(searchLower) ||
          mail.includes(searchLower) ||
          phoneNumber.includes(searchLower)
        );
      });

      if (matchingTicket) {
        // Find which ticket type this ticket belongs to
        const ticketType = ticketTypes.find(
          (type) => type.id === matchingTicket.ticketType.id,
        );

        if (ticketType) {
          onSearchResult(matchingTicket.id, ticketType.name);
        }
      } else {
        onSearchResult(null, null);
      }
    },
    [tickets, ticketTypes, onSearchResult],
  );

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    searchTickets(value);
  };

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 mb-4 mx-auto'>
      <div className='relative max-w-md mx-auto'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
        <Input
          placeholder='Buscar por nombre, DNI, email o teléfono...'
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className='pl-10'
        />
      </div>
    </div>
  );
}
