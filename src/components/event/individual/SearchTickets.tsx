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
  { id: 'shortId', label: 'ID' },
  { id: 'fullName', label: 'Nombre' },
  { id: 'dni', label: 'DNI' },
  { id: 'mail', label: 'Email' },
  { id: 'phoneNumber', label: 'Teléfono' },
  { id: 'invitedBy', label: 'Organizador' },
] as const;

type SearchFieldId = (typeof SEARCH_FIELDS)[number]['id'];
type Ticket = RouterOutputs['emittedTickets']['getByEventId'][number];

const ALL_SEARCH_FIELDS: SearchFieldId[] = SEARCH_FIELDS.map(
  (field) => field.id,
);

function getTicketFieldValue(ticket: Ticket, field: SearchFieldId) {
  const values: Record<SearchFieldId, string | null | undefined> = {
    shortId: String(ticket.shortId),
    fullName: ticket.fullName,
    dni: ticket.dni,
    mail: ticket.mail,
    phoneNumber: ticket.phoneNumber,
    invitedBy: ticket.ticketGroup.invitedBy,
  };

  return values[field];
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
  const [selectedFields, setSelectedFields] =
    useState<SearchFieldId[]>(ALL_SEARCH_FIELDS);
  const prevExternalValue = useRef<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const isAllSelected = selectedFields.length === ALL_SEARCH_FIELDS.length;

  useEffect(() => {
    if (window.innerWidth >= 768) {
      inputRef.current?.focus();
    }
  }, []);

  const placeholder = useMemo(() => {
    if (isAllSelected) {
      return 'Buscar por ID, nombre, DNI, email, teléfono u organizador...';
    }

    const labels = SEARCH_FIELDS.filter((field) =>
      selectedFields.includes(field.id),
    ).map((field) => field.label.toLowerCase());

    if (labels.length === 1) {
      return `Buscar por ${labels[0]}...`;
    }

    const lastLabel = labels.at(-1);
    return `Buscar por ${labels.slice(0, -1).join(', ')} o ${lastLabel}...`;
  }, [isAllSelected, selectedFields]);

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

    const searchLower = searchTerm
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return tickets.filter((ticket) =>
      selectedFields.some((field) => {
        const value = getTicketFieldValue(ticket, field);
        if (!value) return false;

        return String(value)
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .includes(searchLower);
      }),
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

  const handleToggleAll = (checked: boolean) => {
    if (checked) {
      setSelectedFields(ALL_SEARCH_FIELDS);
    }
  };

  const handleToggleField = (fieldId: SearchFieldId, checked: boolean) => {
    setSelectedFields((current) => {
      if (checked) {
        return ALL_SEARCH_FIELDS.filter(
          (id) => current.includes(id) || id === fieldId,
        );
      }

      const next = current.filter((id) => id !== fieldId);
      return next.length === 0 ? ALL_SEARCH_FIELDS : next;
    });
  };

  return (
    <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 mb-4 mx-auto'>
      <div className='relative mx-auto flex max-w-md'>
        <Search className='pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-gray-400' />
        <Input
          ref={inputRef}
          placeholder={placeholder}
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
              onClick={() => handleToggleAll(!isAllSelected)}
            >
              <Checkbox
                checked={isAllSelected}
                className='pointer-events-none'
              />
              Todos
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {SEARCH_FIELDS.map((field) => {
              const checked = selectedFields.includes(field.id);
              return (
                <DropdownMenuItem
                  key={field.id}
                  onSelect={(event) => event.preventDefault()}
                  onClick={() => handleToggleField(field.id, !checked)}
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
