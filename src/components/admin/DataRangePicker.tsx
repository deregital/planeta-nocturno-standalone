'use client';

import { enUS, es } from 'date-fns/locale';
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  Loader,
} from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DateInput } from '@/components/ui/date-input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange; rangeCompare?: DateRange }) => void;
  /** Initial value for start date */
  initialDateFrom?: Date | string;
  /** Initial value for end date */
  initialDateTo?: Date | string;
  /** Initial value for start date for compare */
  initialCompareFrom?: Date | string;
  /** Initial value for end date for compare */
  initialCompareTo?: Date | string;
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end';
  /** Option for locale */
  locale?: string;
  /** Option for showing compare feature */
  showCompare?: boolean;

  value: {
    from: Date;
    to: Date | undefined;
  };
}

const formatDate = (
  date: Date,
  locale: string = 'es-AR',
  opts: {
    month?: 'short' | 'long';
    day?: 'numeric' | '2-digit';
    year?: 'numeric' | '2-digit';
  } = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
): string => {
  return date.toLocaleDateString(locale, opts);
};

interface DateRange {
  from: Date;
  to: Date | undefined;
}

interface Preset {
  name: string;
  label: string;
}

// Define presets
const PRESETS: Preset[] = [
  { name: 'last7', label: 'Últimos 7 días' },
  { name: 'last14', label: 'Últimos 14 días' },
  { name: 'last30', label: 'Últimos 30 días' },
  { name: 'thisWeek', label: 'Esta semana' },
  { name: 'lastWeek', label: 'Semana pasada' },
  { name: 'thisMonth', label: 'Este mes' },
  { name: 'lastMonth', label: 'Mes pasado' },
];

/** The DateRangePicker component allows a user to select a range of dates */
export function DateRangePicker({
  initialDateFrom = new Date(new Date().setHours(0, 0, 0, 0)),
  initialDateTo,
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  value,
  align = 'end',
  locale = 'es-AR',
  showCompare = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const [range, setRange] = useState<DateRange>({
    from:
      value.from ?? new Date(new Date(initialDateFrom).setHours(0, 0, 0, 0)),
    to: value.to
      ? value.to
      : initialDateTo
        ? new Date(new Date(initialDateTo).setHours(0, 0, 0, 0))
        : new Date(new Date(initialDateFrom).setHours(0, 0, 0, 0)),
  });
  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: new Date(new Date(initialCompareFrom).setHours(0, 0, 0, 0)),
          to: initialCompareTo
            ? new Date(new Date(initialCompareTo).setHours(0, 0, 0, 0))
            : new Date(new Date(initialCompareFrom).setHours(0, 0, 0, 0)),
        }
      : undefined,
  );

  // Refs to store the values of range and rangeCompare when the date picker is opened
  const openedRangeRef = useRef<DateRange | undefined>(undefined);
  const openedRangeCompareRef = useRef<DateRange | undefined>(undefined);

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(
    undefined,
  );

  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth < 960 : false,
  );
  const [isLargeScreen, setIsLargeScreen] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : false,
  );

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    // Set initial screen size state after mount
    if (typeof window !== 'undefined') {
      setIsSmallScreen(window.innerWidth < 960);
      setIsLargeScreen(window.innerWidth >= 1200);
    }
  }, []);

  useEffect(() => {
    if (value.from && value.to) {
      setRange({
        from: value.from,
        to: value.to,
      });
    }
  }, [value]);

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 960);
      setIsLargeScreen(window.innerWidth >= 1200);
    };

    window.addEventListener('resize', handleResize);

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const getPresetRange = (presetName: string): DateRange => {
    const preset = PRESETS.find(({ name }) => name === presetName);
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`);
    const from = new Date();
    const to = new Date();
    const first = from.getDate() - from.getDay();

    switch (preset.name) {
      case 'last7':
        from.setDate(from.getDate() - 6);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'last14':
        from.setDate(from.getDate() - 13);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'last30':
        from.setDate(from.getDate() - 29);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'thisWeek':
        from.setDate(first);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'lastWeek':
        from.setDate(from.getDate() - 7 - from.getDay());
        to.setDate(to.getDate() - to.getDay() - 1);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'thisMonth':
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case 'lastMonth':
        from.setMonth(from.getMonth() - 1);
        from.setDate(1);
        from.setHours(0, 0, 0, 0);
        to.setDate(0);
        to.setHours(23, 59, 59, 999);
        break;
    }

    return { from, to };
  };

  const setPreset = (preset: string): void => {
    const range = getPresetRange(preset);
    setRange(range);
    if (rangeCompare) {
      const rangeCompare = {
        from: new Date(
          range.from.getFullYear() - 1,
          range.from.getMonth(),
          range.from.getDate(),
        ),
        to: range.to
          ? new Date(
              range.to.getFullYear() - 1,
              range.to.getMonth(),
              range.to.getDate(),
            )
          : undefined,
      };
      setRangeCompare(rangeCompare);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkPreset = (): void => {
    for (const preset of PRESETS) {
      const presetRange = getPresetRange(preset.name);

      const normalizedRangeFrom = new Date(range.from.setHours(0, 0, 0, 0));
      const normalizedPresetFrom = new Date(
        presetRange.from.setHours(0, 0, 0, 0),
      );

      const normalizedRangeTo = new Date(range.to?.setHours(0, 0, 0, 0) ?? 0);
      const normalizedPresetTo = new Date(
        presetRange.to?.setHours(0, 0, 0, 0) ?? 0,
      );

      if (
        normalizedRangeFrom.getTime() === normalizedPresetFrom.getTime() &&
        normalizedRangeTo.getTime() === normalizedPresetTo.getTime()
      ) {
        setSelectedPreset(preset.name);
        return;
      }
    }

    setSelectedPreset(undefined);
  };

  const resetValues = (): void => {
    setRange({
      from:
        typeof initialDateFrom === 'string'
          ? new Date(initialDateFrom)
          : initialDateFrom,
      to: initialDateTo
        ? typeof initialDateTo === 'string'
          ? new Date(initialDateTo)
          : initialDateTo
        : typeof initialDateFrom === 'string'
          ? new Date(initialDateFrom)
          : initialDateFrom,
    });
    setRangeCompare(
      initialCompareFrom
        ? {
            from:
              typeof initialCompareFrom === 'string'
                ? new Date(initialCompareFrom)
                : initialCompareFrom,
            to: initialCompareTo
              ? typeof initialCompareTo === 'string'
                ? new Date(initialCompareTo)
                : initialCompareTo
              : typeof initialCompareFrom === 'string'
                ? new Date(initialCompareFrom)
                : initialCompareFrom,
          }
        : undefined,
    );
  };

  useEffect(() => {
    checkPreset();
  }, [checkPreset, value]);

  function PresetButton({
    preset,
    label,
    isSelected,
  }: {
    preset: string;
    label: string;
    isSelected: boolean;
  }): JSX.Element {
    return (
      <Button
        className={cn(isSelected && 'pointer-events-none')}
        variant='ghost'
        onClick={() => {
          setPreset(preset);
        }}
      >
        <>
          <span className={cn('pr-2 opacity-0', isSelected && 'opacity-70')}>
            <CheckIcon width={18} height={18} />
          </span>
          {label}
        </>
      </Button>
    );
  }

  // Helper function to check if two date ranges are equal
  const areRangesEqual = (a?: DateRange, b?: DateRange) => {
    if (!a || !b) return a === b; // If either is undefined, return true if both are undefined
    return (
      a.from.getTime() === b.from.getTime() &&
      (!a.to || !b.to || a.to.getTime() === b.to.getTime())
    );
  };

  useEffect(() => {
    if (isOpen) {
      openedRangeRef.current = range;
      openedRangeCompareRef.current = rangeCompare;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Popover
      modal={true}
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues();
        }
        setIsOpen(open);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          size={'lg'}
          className='w-full h-full border-stroke text-accent hover:bg-transparent text-[clamp(0.875rem,2.5vw+0.5rem,1.25rem)]'
          variant={'outline'}
        >
          {isMounted ? (
            <>
              <div className='text-right'>
                <div className='py-1'>
                  {isLargeScreen
                    ? `${formatDate(range.from, locale)}${
                        range.to != null
                          ? ' - ' + formatDate(range.to, locale)
                          : ''
                      }`
                    : `${formatDate(range.from, locale, {
                        month: 'short',
                        day: '2-digit',
                      })}${
                        range.to != null
                          ? ' - ' +
                            formatDate(range.to, locale, {
                              month: 'short',
                              day: '2-digit',
                            })
                          : ''
                      }`}
                </div>
                {rangeCompare != null && (
                  <div className='-mt-1 text-xs opacity-60'>
                    <>
                      vs.{' '}
                      {isLargeScreen
                        ? formatDate(rangeCompare.from, locale)
                        : formatDate(rangeCompare.from, locale, {
                            month: 'short',
                            day: '2-digit',
                          })}
                      {rangeCompare.to != null
                        ? ` - ${
                            isLargeScreen
                              ? formatDate(rangeCompare.to, locale)
                              : formatDate(rangeCompare.to, locale, {
                                  month: 'short',
                                  day: '2-digit',
                                })
                          }`
                        : ''}
                    </>
                  </div>
                )}
              </div>
              <div className='-mr-2 scale-125 pl-1 opacity-60'>
                {isOpen ? (
                  <ChevronUpIcon width={24} />
                ) : (
                  <ChevronDownIcon width={24} />
                )}
              </div>
            </>
          ) : (
            <Loader />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className='w-auto min-w-[--radix-popper-anchor-width]'
      >
        <div className='flex py-2'>
          <div className='flex w-full'>
            <div className='flex w-full flex-col'>
              <div className='flex w-full flex-col items-center justify-end gap-2 px-3 pb-4 lg:flex-row lg:items-start lg:pb-0'>
                {showCompare && (
                  <div className='flex items-center space-x-2 py-1 pr-4'>
                    <Switch
                      defaultChecked={Boolean(rangeCompare)}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          if (!range.to) {
                            setRange({
                              from: range.from,
                              to: range.from,
                            });
                          }
                          setRangeCompare({
                            from: new Date(
                              range.from.getFullYear(),
                              range.from.getMonth(),
                              range.from.getDate() - 365,
                            ),
                            to: range.to
                              ? new Date(
                                  range.to.getFullYear() - 1,
                                  range.to.getMonth(),
                                  range.to.getDate(),
                                )
                              : new Date(
                                  range.from.getFullYear() - 1,
                                  range.from.getMonth(),
                                  range.from.getDate(),
                                ),
                          });
                        } else {
                          setRangeCompare(undefined);
                        }
                      }}
                      id='compare-mode'
                    />
                    <Label htmlFor='compare-mode'>Compare</Label>
                  </div>
                )}
                <div className='flex flex-col gap-2'>
                  <div className='flex gap-2'>
                    <DateInput
                      value={range.from}
                      onChange={(date) => {
                        const toDate =
                          range.to == null || date > range.to ? date : range.to;
                        setRange((prevRange) => ({
                          ...prevRange,
                          from: date,
                          to: toDate,
                        }));
                      }}
                    />
                    <div className='py-1'>-</div>
                    <DateInput
                      value={range.to}
                      onChange={(date) => {
                        const fromDate = date < range.from ? date : range.from;
                        setRange((prevRange) => ({
                          ...prevRange,
                          from: fromDate,
                          to: date,
                        }));
                      }}
                    />
                  </div>
                  {rangeCompare != null && (
                    <div className='flex gap-2'>
                      <DateInput
                        value={rangeCompare?.from}
                        onChange={(date) => {
                          if (rangeCompare) {
                            const compareToDate =
                              rangeCompare.to == null || date > rangeCompare.to
                                ? date
                                : rangeCompare.to;
                            setRangeCompare((prevRangeCompare) => ({
                              ...prevRangeCompare,
                              from: date,
                              to: compareToDate,
                            }));
                          } else {
                            setRangeCompare({
                              from: date,
                              to: new Date(),
                            });
                          }
                        }}
                      />
                      <div className='py-1'>-</div>
                      <DateInput
                        value={rangeCompare?.to}
                        onChange={(date) => {
                          if (rangeCompare && rangeCompare.from) {
                            const compareFromDate =
                              date < rangeCompare.from
                                ? date
                                : rangeCompare.from;
                            setRangeCompare({
                              ...rangeCompare,
                              from: compareFromDate,
                              to: date,
                            });
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {isSmallScreen && (
                <Select
                  defaultValue={selectedPreset}
                  onValueChange={(value: string) => {
                    setPreset(value);
                  }}
                >
                  <SelectTrigger className='mx-auto mb-2 w-[180px]'>
                    <SelectValue placeholder='Elegí rango...' />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className='w-full'>
                <Calendar
                  className='w-full'
                  mode='range'
                  onSelect={(value: { from?: Date; to?: Date } | undefined) => {
                    if (value?.from != null) {
                      setRange({ from: value.from, to: value?.to });
                    }
                  }}
                  locale={locale === 'es-AR' ? es : enUS}
                  selected={range}
                  numberOfMonths={isSmallScreen ? 1 : 2}
                  defaultMonth={
                    new Date(
                      new Date().setMonth(
                        new Date().getMonth() - (isSmallScreen ? 0 : 1),
                      ),
                    )
                  }
                />
              </div>
            </div>
          </div>
          {!isSmallScreen && (
            <div className='flex flex-col items-end gap-1 pl-6 pr-2'>
              <div className='flex w-full flex-col items-end gap-1 pb-6 pl-6 pr-2'>
                {PRESETS.map((preset) => (
                  <PresetButton
                    key={preset.name}
                    preset={preset.name}
                    label={preset.label}
                    isSelected={selectedPreset === preset.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className='flex justify-end gap-2 py-2 pr-4'>
          <Button
            onClick={() => {
              setIsOpen(false);
              resetValues();
            }}
            variant='ghost'
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false);
              if (
                !areRangesEqual(range, openedRangeRef.current) ||
                !areRangesEqual(rangeCompare, openedRangeCompareRef.current)
              ) {
                onUpdate?.({ range, rangeCompare });
              }
            }}
          >
            Actualizar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

DateRangePicker.displayName = 'DateRangePicker';
