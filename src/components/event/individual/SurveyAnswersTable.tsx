'use client';

import { type Row, type StrictColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { useMemo } from 'react';

import { DataTable } from '@/components/common/DataTable';
import { FORM_SEARCH_PARAM } from '@/components/event/individual/ticketsTable/columns';
import { Input } from '@/components/ui/input';
import { type RouterOutputs } from '@/server/routers/app';

type SurveyEvent = NonNullable<RouterOutputs['events']['getBySlug']>;

export type SurveyAnswerRow = {
  id: string;
  purchase: string;
  searchable: string;
  answersByQuestionId: Record<string, string>;
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function generateSurveyAnswerColumns(
  questions: SurveyEvent['questions'],
): StrictColumnDef<SurveyAnswerRow>[] {
  return [
    {
      id: 'purchase',
      accessorKey: 'purchase',
      header: () => <div>Comprador</div>,
      cell: ({ row }) => row.original.purchase,
      meta: {
        exportHeader: 'Comprador',
        exportValue: (row: Row<SurveyAnswerRow>) => row.original.purchase,
      },
    },
    ...questions.map((question) => ({
      id: question.id,
      accessorFn: (row: SurveyAnswerRow) =>
        row.answersByQuestionId[question.id] ?? '-',
      header: () => <div>{question.text}</div>,
      cell: ({ row }: { row: Row<SurveyAnswerRow> }) =>
        row.original.answersByQuestionId[question.id] ?? '-',
      meta: {
        exportHeader: question.text,
        exportValue: (row: Row<SurveyAnswerRow>) =>
          row.original.answersByQuestionId[question.id] ?? '-',
      },
    })),
  ];
}

export function SurveyAnswersTable({ event }: { event: SurveyEvent }) {
  const [search, setSearch] = useQueryState(
    FORM_SEARCH_PARAM,
    parseAsString.withDefault(''),
  );

  const rows = useMemo(
    () =>
      event.ticketGroups
        .filter((ticketGroup) => !ticketGroup.isOrganizerGroup)
        .filter((ticketGroup) => ticketGroup.answers.length > 0)
        .map((ticketGroup) => {
          const firstTicket = ticketGroup.emittedTickets[0];
          const purchase = firstTicket
            ? `${firstTicket.fullName} - DNI ${firstTicket.dni} (${firstTicket.mail})`
            : `Compra ${format(new Date(ticketGroup.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}`;

          const answersByQuestionId = Object.fromEntries(
            ticketGroup.answers.map((answer) => [
              answer.questionId,
              answer.answer,
            ]),
          );

          const searchable = normalize(
            [
              firstTicket?.fullName,
              firstTicket?.dni,
              firstTicket?.mail,
              ...Object.values(answersByQuestionId),
            ]
              .filter(Boolean)
              .join(' '),
          );

          return {
            id: ticketGroup.id,
            purchase,
            searchable,
            answersByQuestionId,
          };
        }),
    [event.ticketGroups],
  );

  const filteredRows = useMemo(() => {
    const term = normalize(search ?? '');
    if (!term) return rows;
    return rows.filter((row) => row.searchable.includes(term));
  }, [rows, search]);

  const columns = useMemo(
    () => generateSurveyAnswerColumns(event.questions),
    [event.questions],
  );

  if (event.questions.length === 0) {
    return null;
  }

  return (
    <div id='form-answers'>
      <div className='w-full px-4'>
        <h2 className='text-3xl font-bold text-accent my-4'>
          Respuestas del formulario
        </h2>
      </div>
      <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mt-4 mb-4 mx-auto'>
        <div className='relative max-w-md mx-auto'>
          <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
          <Input
            placeholder='Buscar por nombre, DNI, email o respuesta...'
            value={search ?? ''}
            onChange={(e) => setSearch(e.target.value || null)}
            className='pl-10'
          />
        </div>
      </div>
      <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mb-8 overflow-x-hidden'>
        <DataTable
          columns={columns}
          data={filteredRows}
          exportFileName={`Formulario-${event.slug}`}
          noResultsPlaceholder='Todavía no hay respuestas para las preguntas de este evento.'
        />
      </div>
    </div>
  );
}
