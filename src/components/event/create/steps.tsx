'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { EventCreationInformation } from '@/components/event/create/EventCreationInformation';

const steps = [
  {
    title: 'Información general',
    component: <EventCreationInformation />,
  },
  {
    title: 'Tipos de entradas',
    component: <div>Step 2</div>,
  },
  {
    title: 'Revisión y publicación',
    component: <div>Step 3</div>,
  },
];

export function Steps() {
  const [currentStep, setCurrentStep] = useState(1);

  return (
    <Stepper
      value={currentStep}
      onValueChange={setCurrentStep}
      className='space-y-8 max-w-5xl px-4'
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
              <StepperIndicator className='font-bold data-[state=completed]:bg-pn-accent data-[state=active]:bg-pn-accent/80 data-[state=inactive]:bg-pn-gray/75'>
                {index + 1}
              </StepperIndicator>
              <StepperTitle>{step.title}</StepperTitle>
            </StepperTrigger>
            {steps.length > index + 1 && (
              <StepperSeparator
                className={cn(
                  'absolute top-3 inset-x-0 left-[calc(50%+0.875rem)] m-0',
                  'group-data-[orientation=horizontal]/stepper-nav:w-[calc(100%-2rem+0.225rem)]',
                  'group-data-[orientation=horizontal]/stepper-nav:flex-none group-data-[state=completed]/step:bg-pn-accent',
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

      <div className='flex items-center justify-between gap-2.5'>
        <Button
          variant='outline'
          onClick={() => setCurrentStep((prev) => prev - 1)}
          disabled={currentStep === 1}
        >
          Previous
        </Button>
        <Button
          variant='outline'
          onClick={() => setCurrentStep((prev) => prev + 1)}
          disabled={currentStep === steps.length}
        >
          Next
        </Button>
      </div>
    </Stepper>
  );
}
