import { isValid, parse } from 'date-fns';
import { useEffect, useRef, useState } from 'react';

import GenericInputWithLabel from '@/components/common/GenericInputWithLabel';
import { Input } from '@/components/ui/input';
import useMobileLikeInput from '@/hooks/useMobileLikeInput';

type InputDateWithLabelProps = Omit<
  React.ComponentProps<typeof Input>,
  'onChange' | 'value' | 'type' | 'id'
> & {
  label: string;
  id: string;
  onChange?: (date: Date) => void;
  error?: string;
  selected?: Date;
  dateType?: 'date' | 'datetime-local';
};

function parseInputDate(
  value: string,
  dateType: 'date' | 'datetime-local',
): Date | null {
  const parsed =
    dateType === 'datetime-local'
      ? parse(value, "yyyy-MM-dd'T'HH:mm", new Date())
      : parse(value, 'yyyy-MM-dd', new Date());
  return isValid(parsed) ? parsed : null;
}

function getDateParts(date: Date | undefined) {
  if (!date || !isValid(date)) return { day: '', month: '', year: '' };
  return {
    day: String(date.getDate()).padStart(2, '0'),
    month: String(date.getMonth() + 1).padStart(2, '0'),
    year: String(date.getFullYear()),
  };
}

function getDatePartsFromString(value: string | undefined) {
  if (!value) return { day: '', month: '', year: '' };
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return { day: '', month: '', year: '' };
  return { year: match[1], month: match[2], day: match[3] };
}

function formatDateForInput(date: Date | undefined, dateType: string): string {
  if (!date || !isValid(date)) return '';
  const y = String(date.getFullYear()).padStart(4, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  if (dateType === 'datetime-local') {
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${min}`;
  }
  return `${y}-${mo}-${d}`;
}

function isValidDateParts({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}) {
  if (!day || !month || year.length !== 4) return false;
  if (day.length > 2 || month.length > 2) return false;

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(year);

  if (
    Number.isNaN(dayNumber) ||
    Number.isNaN(monthNumber) ||
    Number.isNaN(yearNumber)
  ) {
    return false;
  }

  if (monthNumber < 1 || monthNumber > 12) return false;
  if (dayNumber < 1 || dayNumber > 31) return false;
  if (yearNumber < 1900 || yearNumber > 9999) return false;

  const candidate = new Date(yearNumber, monthNumber - 1, dayNumber);
  return (
    candidate.getFullYear() === yearNumber &&
    candidate.getMonth() === monthNumber - 1 &&
    candidate.getDate() === dayNumber
  );
}

function toIsoDateFromParts({
  day,
  month,
  year,
}: {
  day: string;
  month: string;
  year: string;
}) {
  const normalizedDay = day.padStart(2, '0');
  const normalizedMonth = month.padStart(2, '0');
  return `${year}-${normalizedMonth}-${normalizedDay}`;
}

function validateDateAgainstLimits(
  dateString: string,
  min?: string,
  max?: string,
) {
  if (min && dateString < min) return false;
  if (max && dateString > max) return false;
  return true;
}

export default function InputDateWithLabel({
  label,
  error,
  onChange,
  selected,
  dateType = 'date',
  ...inputProps
}: InputDateWithLabelProps) {
  const defaultValueAsString =
    typeof inputProps.defaultValue === 'string'
      ? inputProps.defaultValue
      : undefined;
  const [inputValue, setInputValue] = useState(
    formatDateForInput(selected, dateType) || defaultValueAsString || '',
  );
  const [dateParts, setDateParts] = useState(
    getDateParts(selected).year
      ? getDateParts(selected)
      : getDatePartsFromString(defaultValueAsString),
  );
  const isMobileLike = useMobileLikeInput();
  const [dateError, setDateError] = useState<string | undefined>(undefined);
  const isUserInput = useRef(false);
  const minDate =
    typeof inputProps.min === 'string' ? inputProps.min : undefined;
  const maxDate =
    typeof inputProps.max === 'string' ? inputProps.max : undefined;

  useEffect(() => {
    if (isUserInput.current) {
      isUserInput.current = false;
      return;
    }
    const nextInputValue =
      formatDateForInput(selected, dateType) || defaultValueAsString || '';
    setInputValue(nextInputValue);
    setDateParts(
      getDateParts(selected).year
        ? getDateParts(selected)
        : getDatePartsFromString(defaultValueAsString),
    );
  }, [selected, dateType, defaultValueAsString]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    if (value) {
      const date = parseInputDate(value, dateType);
      if (date) {
        isUserInput.current = true;
        onChange?.(date);
      }
    }
  };

  const handlePartChange =
    (part: 'day' | 'month' | 'year') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const nextValue = e.target.value
        .replace(/\D/g, '')
        .slice(0, part === 'year' ? 4 : 2);

      setDateParts((prev) => {
        const updated = { ...prev, [part]: nextValue };
        if (!updated.day || !updated.month || !updated.year) {
          setDateError(undefined);
          return updated;
        }

        if (!isValidDateParts(updated)) {
          setDateError('Fecha invalida');
          return updated;
        }

        const joinedValue = toIsoDateFromParts(updated);
        if (!validateDateAgainstLimits(joinedValue, minDate, maxDate)) {
          setDateError('Fecha fuera de rango');
          return updated;
        }
        setDateError(undefined);

        const parsed = parseInputDate(joinedValue, 'date');

        if (parsed) {
          isUserInput.current = true;
          onChange?.(parsed);
          setInputValue(formatDateForInput(parsed, 'date'));
        }

        return updated;
      });
    };

  const joinedDateValue =
    dateParts.day &&
    dateParts.month &&
    dateParts.year &&
    isValidDateParts(dateParts) &&
    validateDateAgainstLimits(toIsoDateFromParts(dateParts), minDate, maxDate)
      ? toIsoDateFromParts(dateParts)
      : '';

  return (
    <GenericInputWithLabel
      label={label}
      id={inputProps.id || ''}
      className={inputProps.className}
      required={inputProps.required}
      error={error || dateError}
    >
      {isMobileLike && dateType === 'date' ? (
        <div className='flex gap-2'>
          <div className='flex-1'>
            <p className='mb-1 text-xs text-muted-foreground'>Día</p>
            <Input
              type='text'
              inputMode='numeric'
              placeholder='dd'
              aria-label='Dia'
              value={dateParts.day}
              onChange={handlePartChange('day')}
              maxLength={2}
            />
          </div>
          <div className='self-end pb-2 text-muted-foreground'>/</div>
          <div className='flex-1'>
            <p className='mb-1 text-xs text-muted-foreground'>Mes</p>
            <Input
              type='text'
              inputMode='numeric'
              placeholder='mm'
              aria-label='Mes'
              value={dateParts.month}
              onChange={handlePartChange('month')}
              maxLength={2}
            />
          </div>
          <div className='self-end pb-2 text-muted-foreground'>/</div>
          <div className='flex-1'>
            <p className='mb-1 text-xs text-muted-foreground'>Año</p>
            <Input
              type='text'
              inputMode='numeric'
              placeholder='aaaa'
              aria-label='Año'
              value={dateParts.year}
              onChange={handlePartChange('year')}
              maxLength={4}
            />
          </div>
          <input
            type='hidden'
            name={inputProps.name}
            value={joinedDateValue}
            required={inputProps.required}
            onChange={() => {}}
          />
        </div>
      ) : (
        <Input
          {...inputProps}
          type={dateType}
          value={inputValue}
          onChange={handleInputChange}
        />
      )}
    </GenericInputWithLabel>
  );
}
