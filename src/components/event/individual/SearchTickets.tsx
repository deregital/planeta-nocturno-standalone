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
import { type Role } from '@/server/types';

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
      return [String(ticket.shortId)];
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

function getAvailableFields(role: Role | undefined) {
  if (role === 'ORGANIZER') {
    return SEARCH_FIELDS.filter((field) => field.id !== 'invitedBy');
  }
  return SEARCH_FIELDS;
}

function getPlaceholder(role: Role | undefined) {
  if (role === 'ORGANIZER') {
    return 'Buscar por ID, nombre, DNI, email o teléfono...';
  }
  return 'Buscar por ID, nombre, DNI, email, teléfono u organizador...';
}

interface SearchTicketsProps {
  tickets: RouterOutputs['emittedTickets']['getByEventId'] | undefined;
  onFilteredTicketsChange: (
    filteredTickets:
      | RouterOutputs['emittedTickets']['getByEventId']
      | undefined,
  ) => void;
  role?: Role;
  externalSearchValue?: string;
  externalFilterInvitedByIds?: string[];
  onClearOrganizerFilter?: () => void;
}

export function SearchTickets({
  tickets,
  onFilteredTicketsChange,
  role,
  externalSearchValue,
  externalFilterInvitedByIds,
  onClearOrganizerFilter,
}: SearchTicketsProps) {
  const availableFields = useMemo(() => getAvailableFields(role), [role]);
  const availableFieldIds = useMemo(
    () => availableFields.map((field) => field.id),
    [availableFields],
  );

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFields, setSelectedFields] = useState(
    () => new Set<SearchFieldId>(availableFieldIds),
  );
  const prevExternalValue = useRef<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = availableFieldIds.every((id) => selectedFields.has(id));

  useEffect(() => {
    setSelectedFields((current) => {
      const next = new Set(
        [...current].filter((id) => availableFieldIds.includes(id)),
      );
      if (next.size === 0) {
        return new Set(availableFieldIds);
      }
      return next;
    });
  }, [availableFieldIds]);

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
    const fields = availableFieldIds.filter((id) => selectedFields.has(id));

    return tickets.filter((ticket) =>
      fields.some((field) =>
        getFieldValues(ticket, field).some((value) =>
          normalize(value).includes(term),
        ),
      ),
    );
  }, [
    tickets,
    searchTerm,
    selectedFields,
    availableFieldIds,
    externalFilterInvitedByIds,
  ]);

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
    setSelectedFields(isAllSelected ? new Set() : new Set(availableFieldIds));
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
          placeholder={getPlaceholder(role)}
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
            {availableFields.map((field) => {
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
