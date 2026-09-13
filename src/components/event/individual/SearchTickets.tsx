'use client';

import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { type RouterOutputs } from '@/server/routers/app';

const SEARCH_FIELDS = [
  { id: 'id', label: 'ID' },
  { id: 'fullName', label: 'Nombre' },
  { id: 'dni', label: 'DNI' },
  { id: 'mail', label: 'Email' },
  { id: 'phoneNumber', label: 'Teléfono' },
  { id: 'invitedBy', label: 'Organizador' },
] as const;

type SearchFieldId = (typeof SEARCH_FIELDS)[number]['id'];
type Ticket = RouterOutputs['emittedTickets']['getByEventId'][number];

const ALL_FIELD_IDS: SearchFieldId[] = SEARCH_FIELDS.map((field) => field.id);
const PLACEHOLDER =
  'Buscar por ID, nombre, DNI, email, teléfono u organizador...';

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getFieldValues(ticket: Ticket, field: SearchFieldId): string[] {
  switch (field) {
    case 'id':
      return [String(ticket.shortId), ticket.buyerCode].filter(
        (value): value is string => Boolean(value),
      );
    case 'fullName':
      return ticket.fullName ? [ticket.fullName] : [];
    case 'dni':
      return ticket.dni ? [ticket.dni] : [];
    case 'mail':
      return ticket.mail ? [ticket.mail] : [];
    case 'phoneNumber':
      return ticket.phoneNumber ? [ticket.phoneNumber] : [];
    case 'invitedBy':
      return ticket.ticketGroup.invitedBy ? [ticket.ticketGroup.invitedBy] : [];
  }
}

interface SearchTicketsProps {
  tickets: RouterOutputs['emittedTickets']['getByEventId'] | undefined;
  onFilteredTicketsChange: (
    filteredTickets:
      | RouterOutputs['emittedTickets']['getByEventId']
      | undefined,
  ) => void;
  externalSearchValue?: string;
  externalFilterInvitedByIds?: string[];
  onClearOrganizerFilter?: () => void;
}

export function SearchTickets({
  tickets,
  onFilteredTicketsChange,
  externalSearchValue,
  externalFilterInvitedByIds,
  onClearOrganizerFilter,
}: SearchTicketsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState(
    () => new Set<SearchFieldId>(ALL_FIELD_IDS),
  );
  const prevExternalValue = useRef<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = selectedFields.size === ALL_FIELD_IDS.length;

  useEffect(() => {
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

  const filteredTickets = useMemo(() => {
    if (!tickets) return tickets;

    if (externalFilterInvitedByIds?.length) {
      const idSet = new Set(externalFilterInvitedByIds);
      return tickets.filter(
        (ticket) =>
          ticket.ticketGroup.invitedById != null &&
          idSet.has(ticket.ticketGroup.invitedById),
      );
    }

    if (!searchTerm.trim()) return tickets;

    const term = normalize(searchTerm);

    return tickets.filter((ticket) =>
      [...selectedFields].some((field) =>
        getFieldValues(ticket, field).some((value) =>
          normalize(value).includes(term),
        ),
      ),
    );
  }, [tickets, searchTerm, selectedFields, externalFilterInvitedByIds]);

  useEffect(() => {
    onFilteredTicketsChange(filteredTickets);
  }, [filteredTickets, onFilteredTicketsChange]);

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
    onClearOrganizerFilter?.();
  };

  const handleToggleAll = () => {
    setSelectedFields(isAllSelected ? new Set() : new Set(ALL_FIELD_IDS));
  };

  const handleToggleField = (fieldId: SearchFieldId) => {
    setSelectedFields((current) => {
      const next = new Set(current);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  };

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 mb-4 mx-auto'>
      <div className='relative mx-auto flex max-w-md'>
        <Search className='pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-400' />
        <Input
          ref={inputRef}
          placeholder={PLACEHOLDER}
          value={searchTerm}
          onChange={(e) => handleSearchChange(e.target.value)}
          className='rounded-r-none pl-10'
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              aria-label='Campos de búsqueda'
              className='h-9 w-9 shrink-0 rounded-l-none border border-l-0 border-stroke bg-white hover:bg-accent/5'
            >
              <ChevronDown className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-44'>
            <DropdownMenuItem
              onSelect={(event) => event.preventDefault()}
              onClick={handleToggleAll}
            >
              <Checkbox
                checked={isAllSelected}
                className='pointer-events-none'
              />
              Todos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {SEARCH_FIELDS.map((field) => {
              const checked = selectedFields.has(field.id);
              return (
                <DropdownMenuItem
                  key={field.id}
                  onSelect={(event) => event.preventDefault()}
                  onClick={() => handleToggleField(field.id)}
                >
                  <Checkbox checked={checked} className='pointer-events-none' />
                  {field.label}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
