'use client';

import { Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Input } from '@/components/ui/input';
import { type RouterOutputs } from '@/server/routers/app';

interface SearchTicketsProps {
  tickets: RouterOutputs['emittedTickets']['getByEventId'] | undefined;
  onFilteredTicketsChange: (
    filteredTickets:
      | RouterOutputs['emittedTickets']['getByEventId']
      | undefined,
  ) => void;
  externalSearchValue?: string;
}

export function SearchTickets({
  tickets,
  onFilteredTicketsChange,
  externalSearchValue,
}: SearchTicketsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const prevExternalValue = useRef<string | undefined>(undefined);

  // Filter tickets based on search term
  const filteredTickets = useMemo(() => {
    if (!tickets || !searchTerm.trim()) return tickets;

    return tickets.filter((ticket) => {
      const searchLower = searchTerm
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

      const searchableFields = [
        ticket.fullName,
        ticket.dni,
        ticket.mail,
        ticket.phoneNumber,
        ticket.ticketGroup.invitedBy,
      ].filter(Boolean);

      return searchableFields.some((field) => {
        const normalizedField = String(field)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '');
        return normalizedField.includes(searchLower);
      });
    });
  }, [tickets, searchTerm]);

  // Notify parent component of filtered tickets
  useEffect(() => {
    onFilteredTicketsChange(filteredTickets);
  }, [filteredTickets, onFilteredTicketsChange]);

  // Sync external search value - only set when it comes from outside (card click)
  useEffect(() => {
    if (
      externalSearchValue !== undefined &&
      externalSearchValue !== prevExternalValue.current
    ) {
      prevExternalValue.current = externalSearchValue;
      setSearchTerm(externalSearchValue);
    }
  }, [externalSearchValue]);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 mb-4 mx-auto'>
      <div className='relative max-w-md mx-auto'>
        <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
        <Input
          placeholder='Buscar por nombre, DNI, email, teléfono o organizador...'
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className='pl-10'
        />
      </div>
    </div>
  );
}
