import { useVirtualizer } from '@tanstack/react-virtual';
import { Check, ChevronsUpDown } from 'lucide-react';
import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
};

type SeparatorOption = {
  type: 'separator';
  id: string;
};

type GroupedOption = {
  group: string;
  options: Option[];
};

type AllOption = Option | SeparatorOption;

interface VirtualizedCommandProps {
  height: string;
  options: Option[];
  groupedOptions?: GroupedOption[];
  notFoundPlaceholder?: string;
  placeholder: string;
  selectedOption: string;
  onSelectOption?: (option: string) => void;
}

function VirtualizedCommand({
  height,
  options,
  groupedOptions,
  notFoundPlaceholder,
  placeholder,
  selectedOption,
  onSelectOption,
}: VirtualizedCommandProps) {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isKeyboardNavActive, setIsKeyboardNavActive] = useState(false);

  const parentRef = useRef(null);

  // Aplanar opciones agrupadas para el virtualizer con separadores
  const allOptions = useMemo(() => {
    const flatOptions: AllOption[] = [];

    if (groupedOptions) {
      groupedOptions.forEach((group, index) => {
        // Agregar separador antes de cada grupo excepto el primero
        if (index > 0) {
          flatOptions.push({
            type: 'separator',
            id: `separator-${group.group}-${index}`,
          });
        }
        flatOptions.push(...group.options);
      });
    }

    // Agregar separador entre grupos y opciones individuales si ambos existen
    if (groupedOptions && groupedOptions.length > 0 && options.length > 0) {
      flatOptions.push({ type: 'separator', id: 'groups-separator' });
    }

    return [...flatOptions, ...options];
  }, [groupedOptions, options]);

  const [searchTerm, setSearchTerm] = useState('');

  const handleSearch = (search: string) => {
    setSearchTerm(search);
    setIsKeyboardNavActive(false);
  };

  // Filtrar opciones basado en el término de búsqueda, excluyendo separadores
  const filteredOptions = useMemo(() => {
    if (!searchTerm) return allOptions;

    const searchLower = searchTerm.toLowerCase();
    const filtered = allOptions.filter((option) => {
      // Mantener separadores temporalmente
      if ('type' in option) return true;

      // Buscar en el label de la opción
      return option.label.toLowerCase().includes(searchLower);
    });

    // Limpiar separadores que no tienen opciones antes y después
    const cleaned: AllOption[] = [];
    for (let i = 0; i < filtered.length; i++) {
      const option = filtered[i];

      if ('type' in option) {
        // Es un separador - mantenerlo solo si hay opciones antes y después
        const hasOptionBefore = i > 0 && !('type' in filtered[i - 1]);
        const hasOptionAfter =
          i < filtered.length - 1 && !('type' in filtered[i + 1]);

        if (hasOptionBefore && hasOptionAfter) {
          cleaned.push(option);
        }
      } else {
        // Es una opción regular - siempre incluirla
        cleaned.push(option);
      }
    }

    return cleaned;
  }, [allOptions, searchTerm, groupedOptions, options]);

  const virtualizer = useVirtualizer({
    count: filteredOptions.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => {
      const option = filteredOptions[index];
      // Separadores tienen una altura más pequeña
      if (option && 'type' in option) {
        return 8;
      }
      return 35;
    },
  });

  const virtualOptions = virtualizer.getVirtualItems();

  const scrollToIndex = (index: number) => {
    virtualizer.scrollToIndex(index, {
      align: 'center',
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          let newIndex = prev === -1 ? 0 : prev + 1;
          // Saltar separadores
          while (
            newIndex < filteredOptions.length &&
            'type' in filteredOptions[newIndex]
          ) {
            newIndex++;
          }
          if (newIndex >= filteredOptions.length) {
            newIndex = filteredOptions.length - 1;
          }
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setIsKeyboardNavActive(true);
        setFocusedIndex((prev) => {
          let newIndex = prev === -1 ? filteredOptions.length - 1 : prev - 1;
          // Saltar separadores
          while (newIndex >= 0 && 'type' in filteredOptions[newIndex]) {
            newIndex--;
          }
          if (newIndex < 0) {
            newIndex = 0;
          }
          scrollToIndex(newIndex);
          return newIndex;
        });
        break;
      }
      case 'Enter': {
        event.preventDefault();
        if (
          filteredOptions[focusedIndex] &&
          !('type' in filteredOptions[focusedIndex])
        ) {
          onSelectOption?.(filteredOptions[focusedIndex].value);
        }
        break;
      }
      default:
        break;
    }
  };

  useEffect(() => {
    if (selectedOption) {
      const option = filteredOptions.find(
        (option) => !('type' in option) && option.value === selectedOption,
      );
      if (option) {
        const index = filteredOptions.indexOf(option);
        setFocusedIndex(index);
        virtualizer.scrollToIndex(index, {
          align: 'center',
        });
      }
    }
  }, [selectedOption, filteredOptions, virtualizer]);

  return (
    <Command shouldFilter={false} onKeyDown={handleKeyDown}>
      <CommandInput onValueChange={handleSearch} placeholder={placeholder} />
      <CommandList
        ref={parentRef}
        style={{
          maxHeight: height,
          height: 'auto',
          width: '100%',
          overflow: 'auto',
        }}
        onMouseDown={() => setIsKeyboardNavActive(false)}
        onMouseMove={() => setIsKeyboardNavActive(false)}
      >
        <CommandEmpty>{notFoundPlaceholder}</CommandEmpty>
        <CommandGroup>
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualOptions.map((virtualOption) => {
              const option = filteredOptions[virtualOption.index];

              // Render separator
              if ('type' in option) {
                return (
                  <div
                    key={option.id}
                    className='absolute left-0 top-0 w-full flex items-center px-2'
                    style={{
                      height: `${virtualOption.size}px`,
                      transform: `translateY(${virtualOption.start}px)`,
                    }}
                  >
                    <div className='flex-1 border-t border-border' />
                  </div>
                );
              }

              // Render regular option
              return (
                <CommandItem
                  key={option.value}
                  disabled={isKeyboardNavActive}
                  className={cn(
                    'absolute left-0 top-0 w-full bg-transparent',
                    focusedIndex === virtualOption.index &&
                      'bg-accent text-accent-foreground',
                    isKeyboardNavActive &&
                      focusedIndex !== virtualOption.index &&
                      'aria-selected:bg-transparent aria-selected:text-primary',
                  )}
                  style={{
                    height: `${virtualOption.size}px`,
                    transform: `translateY(${virtualOption.start}px)`,
                  }}
                  value={option.value}
                  onMouseEnter={() =>
                    !isKeyboardNavActive && setFocusedIndex(virtualOption.index)
                  }
                  onMouseLeave={() =>
                    !isKeyboardNavActive && setFocusedIndex(-1)
                  }
                  onSelect={onSelectOption}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOption === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  {option.label}
                </CommandItem>
              );
            })}
          </div>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

interface VirtualizedComboboxProps {
  options: string[];
  groupedOptions?: GroupedOption[];
  searchPlaceholder?: string;
  notFoundPlaceholder?: string;
  width?: string;
  height?: string;
  onSelectOption?: (option: string) => void;
  showSelectedOptions?: boolean;
  selectedOption?: string;
  onSelectedOptionChange?: (option: string) => void;
}

export function VirtualizedCombobox({
  options,
  groupedOptions,
  searchPlaceholder = 'Buscar opciones...',
  notFoundPlaceholder = 'No se encontraron resultados',
  width = '400px',
  height = '400px',
  onSelectOption,
  showSelectedOptions = true,
  selectedOption: controlledSelectedOption,
  onSelectedOptionChange,
}: VirtualizedComboboxProps) {
  const [open, setOpen] = useState(false);
  const [internalSelectedOption, setInternalSelectedOption] = useState('');

  const selectedOption =
    controlledSelectedOption !== undefined
      ? controlledSelectedOption
      : internalSelectedOption;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          role='combobox'
          aria-expanded={open}
          className='justify-between w-full'
          style={{
            maxWidth: width,
          }}
        >
          {showSelectedOptions && selectedOption
            ? options.find((option) => option === selectedOption)
            : searchPlaceholder}
          <ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 opacity-50' />
        </Button>
      </PopoverTrigger>
      <PopoverContent className='p-0 w-(--radix-popover-trigger-width)'>
        <VirtualizedCommand
          height={height}
          notFoundPlaceholder={notFoundPlaceholder}
          options={options.map((option) => ({ value: option, label: option }))}
          groupedOptions={groupedOptions}
          placeholder={searchPlaceholder}
          selectedOption={selectedOption}
          onSelectOption={(currentValue) => {
            const newValue =
              currentValue === selectedOption ? '' : currentValue;

            if (controlledSelectedOption === undefined) {
              setInternalSelectedOption(newValue);
            }

            onSelectedOptionChange?.(newValue);
            setOpen(false);
            onSelectOption?.(currentValue);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
