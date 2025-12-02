'use client';

import { useState } from 'react';

import { EventGeneralInformation } from '@/components/event/create/EventGeneralInformation';
import { EventInvitationTypeAction } from '@/components/event/create/EventInvitationTypeAction';
import PreviewEvent from '@/components/event/create/PreviewEvent';
import TicketTypeAction from '@/components/event/create/ticketType/TicketTypeAction';
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from '@/components/ui/stepper';
import { cn } from '@/lib/utils';

export function Steps() {
  const [currentStep, setCurrentStep] = useState(1);

  const goBack = () => setCurrentStep((prev) => prev - 1);
  const goNext = () => setCurrentStep((prev) => prev + 1);

  const steps: { title: string; component: React.ReactNode }[] = [
    {
      title: 'Información general',
      component: <EventGeneralInformation action='CREATE' next={goNext} />,
    },
    {
      title: 'Organizadores',
      component: <EventInvitationTypeAction next={goNext} back={goBack} />,
    },
    {
      title: 'Tickets',
      component: <TicketTypeAction back={goBack} next={goNext} />,
    },
    {
      title: 'Revisión y publicación',
      component: <PreviewEvent back={goBack} />,
    },
  ];
  return (
    <Stepper
      value={currentStep}
      onValueChange={setCurrentStep}
      className='space-y-8 max-w-5xl p-4'
    >
      <StepperNav>
        {steps.map((step, index) => (
          <StepperItem
            key={index}
            step={index + 1}
            className='relative flex-1 items-start'
          >
            <StepperTrigger
              asChild
              className='flex flex-col gap-2.5 items-center'
            >
              <StepperIndicator className='font-bold'>
                {index + 1}
              </StepperIndicator>
              <StepperTitle className='text-center'>{step.title}</StepperTitle>
            </StepperTrigger>
            {steps.length > index + 1 && (
              <StepperSeparator
                className={cn(
                  'absolute top-3 inset-x-0 left-[calc(50%+0.875rem)] m-0',
                  'group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)]',
                  'group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-accent',
                )}
              />
            )}
          </StepperItem>
        ))}
      </StepperNav>

      <StepperPanel className='text-sm'>
        {steps.map((step, idx) => (
          <StepperContent
            className='w-full flex items-center justify-center'
            key={idx}
            value={idx + 1}
          >
            {step.component}
          </StepperContent>
        ))}
      </StepperPanel>
    </Stepper>
  );
}
