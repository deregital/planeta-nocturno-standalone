'use client';

import { type Row, type StrictColumnDef } from '@tanstack/react-table';
import { es } from 'date-fns/locale';
import { Search } from 'lucide-react';
import { useQueryStates } from 'nuqs';
import { useMemo } from 'react';

import { DataTable } from '@/components/common/DataTable';
import {
  FORM_SEARCH_PARAM,
  FORM_TICKET_PARAM,
  formAnswerSearchParams,
} from '@/components/event/individual/ticketsTable/columns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatLocalDateTime } from '@/lib/format-date';
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
  questions: SurveyEvent['eventQuestions'],
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
  const [formParams, setFormParams] = useQueryStates(formAnswerSearchParams);
  const search = formParams[FORM_SEARCH_PARAM];
  const ticketId = formParams[FORM_TICKET_PARAM];

  const selectedTicket = useMemo(() => {
    if (!ticketId) return null;
    for (const ticketGroup of event.ticketGroups) {
      const ticket = ticketGroup.emittedTickets.find(
        (emittedTicket) => emittedTicket.id === ticketId,
      );
      if (ticket) {
        return { ticket, groupId: ticketGroup.id };
      }
    }
    return null;
  }, [event.ticketGroups, ticketId]);

  const rows = useMemo(
    () =>
      event.ticketGroups
        .filter((ticketGroup) => !ticketGroup.isOrganizerGroup)
        .filter((ticketGroup) => ticketGroup.ticketGroupAnswers.length > 0)
        .map((ticketGroup) => {
          const firstTicket = ticketGroup.emittedTickets[0];
          const purchase = firstTicket
            ? `${firstTicket.fullName} - DNI ${firstTicket.dni} (${firstTicket.mail})`
            : `Compra ${formatLocalDateTime(ticketGroup.createdAt, 'dd/MM/yyyy HH:mm', { locale: es })}`;

          const answersByQuestionId = Object.fromEntries(
            ticketGroup.ticketGroupAnswers.map((answer) => [
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
    if (ticketId) {
      if (!selectedTicket) return [];
      return rows
        .filter((row) => row.id === selectedTicket.groupId)
        .map((row) => ({
          ...row,
          purchase: `${selectedTicket.ticket.fullName} - DNI ${selectedTicket.ticket.dni} (${selectedTicket.ticket.mail})`,
        }));
    }

    const term = normalize(search ?? '');
    if (!term) return rows;
    return rows.filter((row) => row.searchable.includes(term));
  }, [rows, search, selectedTicket, ticketId]);

  // Mostrar preguntas activas o eliminadas que aún tengan respuestas, para no
  // perder la visualización de respuestas históricas.
  const visibleQuestions = useMemo(() => {
    const answeredQuestionIds = new Set(
      event.ticketGroups.flatMap((ticketGroup) =>
        ticketGroup.ticketGroupAnswers.map((answer) => answer.questionId),
      ),
    );
    return event.eventQuestions.filter(
      (question) => !question.isDeleted || answeredQuestionIds.has(question.id),
    );
  }, [event.eventQuestions, event.ticketGroups]);

  const columns = useMemo(
    () => generateSurveyAnswerColumns(visibleQuestions),
    [visibleQuestions],
  );

  if (visibleQuestions.length === 0) {
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
            onChange={(e) =>
              setFormParams({
                [FORM_SEARCH_PARAM]: e.target.value || null,
                [FORM_TICKET_PARAM]: null,
              })
            }
            className='pl-10'
          />
        </div>
        {ticketId && (
          <div className='mx-auto mt-3 flex max-w-3xl flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2 text-sm'>
            <p>
              {selectedTicket ? (
                <>
                  Respuestas de{' '}
                  <span className='font-medium capitalize'>
                    {selectedTicket.ticket.fullName}
                  </span>{' '}
                  · DNI {selectedTicket.ticket.dni} · Ticket #
                  {selectedTicket.ticket.shortId}
                </>
              ) : (
                'No se encontró el ticket seleccionado.'
              )}
            </p>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onClick={() =>
                setFormParams({
                  [FORM_TICKET_PARAM]: null,
                })
              }
            >
              Ver todas
            </Button>
          </div>
        )}
      </div>
      <div className='w-[calc(100vw-16px)] md:w-[calc(100vw-16px-var(--sidebar-width))] mb-8 overflow-x-hidden'>
        <DataTable
          columns={columns}
          data={filteredRows}
          exportFileName={`Formulario-${event.slug}`}
          noResultsPlaceholder={
            ticketId
              ? 'Este ticket no tiene respuestas de formulario.'
              : 'Todavía no hay respuestas para las preguntas de este evento.'
          }
        />
      </div>
    </div>
  );
}
