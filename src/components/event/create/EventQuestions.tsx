'use client';

import { Plus, Trash2 } from 'lucide-react';

import { useCreateEventStore } from '@/app/(backoffice)/admin/event/create/provider';
import InputWithLabel from '@/components/common/InputWithLabel';
import { Button } from '@/components/ui/button';

type EventQuestionsProps = {
  next?: () => void;
  back?: () => void;
  showNavigation?: boolean;
  embedded?: boolean;
};

export function EventQuestions({
  next,
  back,
  showNavigation = true,
  embedded = false,
}: EventQuestionsProps) {
  const questions = useCreateEventStore((state) => state.questions);
  const addQuestion = useCreateEventStore((state) => state.addQuestion);
  const removeQuestion = useCreateEventStore((state) => state.removeQuestion);
  const updateQuestion = useCreateEventStore((state) => state.updateQuestion);

  return (
    <div className='flex w-full min-w-0 max-w-full flex-col gap-4'>
      {!embedded && (
        <div className='flex flex-col gap-2'>
          <h3 className='text-2xl text-accent font-bold'>
            Preguntas del formulario
          </h3>
          <p className='text-sm text-muted-foreground'>
            Agregá preguntas de texto libre que los compradores deberán
            responder durante el checkout. Este paso es opcional.
          </p>
        </div>
      )}

      {questions.length === 0 ? (
        <p className='text-sm text-muted-foreground italic'>
          No hay preguntas configuradas.
        </p>
      ) : (
        <div className='flex flex-col gap-3'>
          {questions.map((question, index) => (
            <div key={index} className='flex items-end gap-2'>
              <div className='flex-1'>
                <InputWithLabel
                  id={`question-${index}`}
                  label={`Pregunta ${index + 1}`}
                  value={question.text}
                  onChange={(event) =>
                    updateQuestion(index, event.target.value)
                  }
                  placeholder='Ej. ¿Cómo te enteraste del evento?'
                />
              </div>
              <Button
                type='button'
                variant='ghost'
                size='icon'
                onClick={() => removeQuestion(index)}
                aria-label={`Eliminar pregunta ${index + 1}`}
              >
                <Trash2 className='size-4 text-red-500' />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type='button'
        variant='outline'
        className='self-start'
        onClick={addQuestion}
      >
        <Plus className='size-4 mr-2' />
        Agregar pregunta
      </Button>

      {showNavigation && (next || back) && (
        <div className='flex w-full gap-4'>
          {back && (
            <Button className='flex-1' onClick={back} variant='outline'>
              Volver
            </Button>
          )}
          {next && (
            <Button className='flex-1' variant='accent' onClick={next}>
              Continuar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
