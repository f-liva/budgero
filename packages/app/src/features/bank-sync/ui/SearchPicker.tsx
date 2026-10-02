import { useState, type ReactNode } from 'react';
import { Check, ChevronsUpDown, Landmark, Loader2 } from 'lucide-react';
import { cn } from '@shared/lib/utils';
import { Button } from '@shared/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@shared/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@shared/ui/popover';

export interface SearchPickerOption {
  value: string;
  label: string;
  /** Extra words the search matches, e.g. a country code or English name. */
  keywords?: string[];
  icon?: ReactNode;
  hint?: ReactNode;
}

interface SearchPickerProps {
  options: SearchPickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  ariaLabel: string;
  disabled?: boolean;
  loading?: boolean;
}

/** A select with a search box, for long lists like countries and banks. */
export function SearchPicker({
  options,
  value,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  ariaLabel,
  disabled,
  loading,
}: SearchPickerProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={ariaLabel}
          disabled={disabled}
          className="w-full justify-between font-normal"
        >
          <span className="flex min-w-0 items-center gap-2">
            {selected?.icon}
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {selected?.label ?? placeholder}
            </span>
          </span>
          {loading ? (
            <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
          ) : (
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label, ...(option.keywords ?? [])]}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      option.value === value ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                  {option.hint}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Regional-indicator flag emoji; systems without flag glyphs show the two letters. */
export function CountryFlag({ code }: { code: string }) {
  const flag = String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65)
  );
  return (
    <span aria-hidden className="w-5 shrink-0 text-center text-base leading-none">
      {flag}
    </span>
  );
}

/**
 * A bank's logo from Enable Banking's catalogue. The browser loads it straight
 * from Enable Banking, never through Budgero, and falls back to an icon.
 */
export function BankLogo({ src, className }: { src?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span
        aria-hidden
        className={cn('flex h-5 w-5 shrink-0 items-center justify-center', className)}
      >
        <Landmark className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
    );
  }
  return (
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn('h-5 w-5 shrink-0 rounded-sm bg-white object-contain p-px', className)}
    />
  );
}
