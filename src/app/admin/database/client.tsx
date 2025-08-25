'use client';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { genderTranslation } from '@/lib/translations';
import { type RouterOutputs } from '@/server/routers/app';
import { differenceInYears } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function Client({
  buyers,
}: {
  buyers: RouterOutputs['emittedTickets']['getAllUniqueBuyer'];
}) {
  const router = useRouter();
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const paginatedData = buyers.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage,
  );
  const totalPages = Math.ceil(buyers.length / rowsPerPage);

  return (
    <div className='flex flex-col gap-4'>
      <h1 className='text-4xl font-bold p-4'>Base de Datos</h1>
      <div className='overflow-auto max-w-screen md:max-w-[calc(100vw-12rem)]'>
        <Table className='text-md sm:text-lg md:text-xl font-medium '>
          <TableHeader>
            <TableRow className='hover:bg-transparent [&>th]:text-pn-slate [&>th]:font-medium [&>th]:py-4 [&>th]:px-6'>
              <TableHead>DNI</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead>Género</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Instagram</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((buyer, index) => (
              <TableRow
                onClick={() => router.push(`/admin/database/${buyer.dni}`)}
                key={index}
                className='[&>td]:py-6 [&>td]:px-6 hover:cursor-pointer hover:bg-pn-slate/20 [&>td]:truncate [&>td]:max-w-48'
              >
                <TableCell className='text-ellipsis overflow-visible whitespace-normal max-w-full'>
                  {buyer.dni}
                </TableCell>
                <TableCell>{buyer.fullName}</TableCell>
                <TableCell>{buyer.mail}</TableCell>
                <TableCell>
                  {differenceInYears(new Date(), buyer.birthDate)} años
                </TableCell>
                <TableCell>
                  {((buyer.gender === 'female' ||
                    buyer.gender === 'male' ||
                    buyer.gender === 'other') &&
                    genderTranslation[buyer.gender]) ??
                    'No definido'}
                </TableCell>
                <TableCell>{buyer.phoneNumber}</TableCell>
                <TableCell>{buyer.instagram?.length === 0 && '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <div className='flex items-center justify-between text-sm px-4'>
        <div className='flex flex-row justify-center items-center gap-4'>
          <Button disabled={page === 0} onClick={() => setPage(0)}>
            <ChevronsLeftIcon />
          </Button>
          <Button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
          </Button>
          <span>
            Página{' '}
            <span className='font-bold'>
              {page + 1} de {Math.ceil(buyers.length / rowsPerPage)}
            </span>
          </span>
          <Button
            className='p-2'
            disabled={page >= Math.ceil(buyers.length / rowsPerPage) - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight />
          </Button>
          <Button
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
        <div className='flex items-center gap-2'>
          <span>Filas por página:</span>
          <Select
            value={rowsPerPage.toString()}
            onValueChange={(value) => {
              setRowsPerPage(Number(value));
              setPage(0);
            }}
            defaultValue={rowsPerPage.toString()}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='5'>5</SelectItem>
              <SelectItem value='10'>10</SelectItem>
              <SelectItem value='15'>15</SelectItem>
              <SelectItem value='20'>15</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
