import '@tanstack/react-table'; //or vue, svelte, solid, qwik, etc.
import { type ColumnDef, type Row, type RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    exportValue: ((row: Row<TData>) => string) | null;
    exportHeader: string | null;
  }
  type StrictColumnDef<TData extends RowData, TValue = unknown> = ColumnDef<
    TData,
    TValue
  > & {
    meta: {
      exportValue: ((row: Row<TData>) => string | number) | null;
      exportHeader: string | null;
    };
  };
}
