import { type Template } from '@pdfme/common';

import { getColorsAsHex } from '@/lib/get-colors';
import { type EmittedTicket } from '@/server/types';

export type PDFDataOrderName = [
  {
    qr: string;
    ubicacion: string;
    nombre: string;
    fecha: string;
    entradasVendidas: string;
    datos: Array<[string, string, string, string, string, string]>; // [nombre, Tipo de entrada, telefono, dni, si/no, invitado por]
  },
];

export type PDFDataGroupedTicketType = [
  {
    qr: string;
    ubicacion: string;
    nombre: string;
    fecha: string;
    entradasVendidas: string;
    [key: `datos_${string}`]: Array<
      [string, string, string, string, string, string]
    >; // Dynamic keys for each ticket type (datos_${ticketType}) - [nombre, Tipo de entrada, telefono, dni, si/no, invitado por]
    [key: `tipo_entrada_${string}`]: string; // Dynamic keys for each ticket type (tipo_entrada_${ticketType})
  },
];

const commonSchema = [
  {
    name: 'field1',
    type: 'text',
    content: 'Nombre del evento:',
    position: { x: 9, y: 9.3 },
    width: 64.05,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'top',
    fontSize: 18,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: true,
    readOnly: true,
    required: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'field2',
    type: 'text',
    content: 'Fecha:',
    position: { x: 9, y: 20.9 },
    width: 15.63,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: true,
    readOnly: true,
    required: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'field2 copy',
    type: 'text',
    content: 'Ubicación:',
    position: { x: 9, y: 31.7 },
    width: 24.1,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: true,
    readOnly: true,
    required: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'ubicacion',
    type: 'text',
    position: { x: 33.6, y: 31.7 },
    required: true,
    content: 'Juan B. Justo 1579',
    width: 118.55,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'nombre',
    type: 'text',
    position: { x: 69.33, y: 9.3 },
    required: true,
    content: 'Entrenamiento 1 - New Face 1 - T17',
    width: 88.66,
    height: 9.99,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 14,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'fecha',
    type: 'text',
    position: { x: 25.14, y: 20.9 },
    required: true,
    content: '11/08/2024',
    width: 127.29,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'entradas-vendidas-title',
    readOnly: true,
    type: 'text',
    position: { x: 9, y: 40.7 },
    required: false,
    content: 'Entradas vendidas:',
    width: 127.29,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: true,
    fontName: 'DMSans-Light',
  },
  {
    name: 'entradasVendidas',
    type: 'text',
    position: { x: 50.14, y: 40.7 },
    required: true,
    content: '12 de 5000',
    width: 127.29,
    height: 10,
    rotate: 0,
    alignment: 'left',
    verticalAlignment: 'middle',
    fontSize: 13,
    lineHeight: 1,
    characterSpacing: 0,
    fontColor: '#000000',
    backgroundColor: '',
    opacity: 1,
    strikethrough: false,
    underline: false,
    fontName: 'DMSans-Light',
  },
  {
    name: 'field7',
    type: 'line',
    position: { x: 0, y: 50.65 },
    width: 210,
    height: 0.73,
    rotate: 0,
    opacity: 1,
    readOnly: true,
    color: '#303030',
    required: false,
  },
  {
    name: 'qr',
    type: 'qrcode',
    content: 'https://pdfme.com/',
    position: { x: 163.27, y: 5.11 },
    backgroundColor: '#ffffff',
    barColor: '#000000',
    width: 41.9,
    height: 41.9,
    rotate: 0,
    opacity: 1,
    required: true,
  },
];

export function presentismoPDFSchema(): Template {
  const { accentColor, textOnAccent } = getColorsAsHex();
  return {
    schemas: [
      [
        ...commonSchema,
        {
          name: 'datos',
          type: 'table',
          position: { x: 3.38, y: 55.96 },
          width: 202.65,
          height: 52.932,
          content:
            '[["Aylen Katherine Naiquen Alegre Fanelli","99999","54 9 11 6534 4651 980","46581349","Juan Pérez","Sí"],["Ariel Colton","1948","1136005044","46501954","María García",""]]',
          showHead: true,
          head: [
            'Nombre',
            'Tipo de entrada',
            'Núm. de teléfono',
            'DNI',
            'Invitado por',
            '¿Asistió?',
          ],
          headWidthPercentages: [20.0, 14.0, 20.0, 16.0, 15.0, 15.0],
          tableStyles: { borderWidth: 0.3, borderColor: '#000000' },
          headStyles: {
            fontName: 'DMSans-Bold',
            fontSize: 12,
            characterSpacing: 0,
            alignment: 'left',
            verticalAlignment: 'middle',
            lineHeight: 1,
            fontColor: textOnAccent,
            borderColor: '',
            backgroundColor: accentColor,
            borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
            padding: { top: 5, right: 5, bottom: 5, left: 5 },
          },
          bodyStyles: {
            fontName: 'Symbols',
            fontSize: 11,
            characterSpacing: 0,
            alignment: 'left',
            verticalAlignment: 'middle',
            lineHeight: 1,
            fontColor: '#000000',
            borderColor: '#888888',
            backgroundColor: '',
            alternateBackgroundColor: '#f5f5f5',
            borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
            padding: { top: 5, right: 5, bottom: 5, left: 5 },
          },
          columnStyles: {},
          required: true,
        },
      ],
    ],
    basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
    pdfmeVersion: '5.2.4',
  };
}

export function presentismoPDFSchemaGroupedTicketType(
  ticketTypes: Array<{ ticketType: string; tickets: EmittedTicket[] }>,
): Template {
  const { accentLight, textOnAccent } = getColorsAsHex();
  const TEXT_HEIGHT = 10;
  const ROW_HEIGHT = 52.932;
  let offset = 52.96; // Increased from 25.96 to give more top margin

  const ticketTypesWithOffset: Array<
    { ticketType: string; tickets: EmittedTicket[] } & {
      tableOffset: number;
      textOffset: number;
    }
  > = ticketTypes.map((ticketType) => ({
    ticketType: ticketType.ticketType,
    tickets: ticketType.tickets,
    tableOffset: 0,
    textOffset: 0,
  }));

  for (const ticketType of ticketTypesWithOffset) {
    ticketType.textOffset = offset;
    ticketType.tableOffset = offset + TEXT_HEIGHT + 2;
    offset +=
      TEXT_HEIGHT + 2 + ROW_HEIGHT * (ticketType.tickets.length + 1) + 5;
  }

  return {
    schemas: [
      [
        ...commonSchema,
        // one table for each ticket type
        ...ticketTypesWithOffset.flatMap(
          ({ ticketType, tickets, tableOffset, textOffset }) => [
            {
              name: `tipo_entrada_${ticketType}`,
              type: 'text',
              content: `Tipo de entrada: ${ticketType}`,
              position: { x: 3.38, y: textOffset },
              width: 202.65,
              height: 10,
              rotate: 0,
              alignment: 'left',
              verticalAlignment: 'middle',
              fontSize: 13,
              lineHeight: 1,
              characterSpacing: 0,
              fontColor: '#000000',
              backgroundColor: '',
              opacity: 1,
              strikethrough: false,
              underline: true,
              required: true,
              fontName: 'DMSans-Light',
            },
            {
              name: `datos_${ticketType}`,
              type: 'table',
              position: { x: 3.38, y: tableOffset },
              width: 202.65,
              height: 52.932 * (tickets.length + 1),
              content:
                '[["Aylen Katherine Naiquen Alegre Fanelli","99999","54 9 11 6534 4651 980","46581349","Juan Pérez","Sí"],["Ariel Colton","1948","1136005044","46501954","María García",""]]',
              showHead: true,
              head: [
                'Nombre',
                'Tipo de entrada',
                'Núm. de teléfono',
                'DNI',
                'Invitado por',
                '¿Asistió?',
              ],
              headWidthPercentages: [20.0, 14.0, 20.0, 16.0, 15.0, 15.0],
              tableStyles: { borderWidth: 0.3, borderColor: '#000000' },
              headStyles: {
                fontName: 'DMSans-Bold',
                fontSize: 13,
                characterSpacing: 0,
                alignment: 'left',
                verticalAlignment: 'middle',
                lineHeight: 1,
                fontColor: textOnAccent,
                borderColor: '',
                backgroundColor: accentLight,
                borderWidth: { top: 0, right: 0, bottom: 0, left: 0 },
                padding: { top: 5, right: 5, bottom: 5, left: 5 },
              },
              bodyStyles: {
                fontName: 'Symbols',
                fontSize: 11,
                characterSpacing: 0,
                alignment: 'left',
                verticalAlignment: 'middle',
                lineHeight: 1,
                fontColor: '#000000',
                borderColor: '#888888',
                backgroundColor: '',
                alternateBackgroundColor: '#f5f5f5',
                borderWidth: { top: 0.1, right: 0.1, bottom: 0.1, left: 0.1 },
                padding: { top: 5, right: 5, bottom: 5, left: 5 },
              },
              columnStyles: {},
              required: true,
            },
          ],
        ),
      ],
    ],
    basePdf: { width: 210, height: 297, padding: [0, 0, 0, 0] },
    pdfmeVersion: '5.2.4',
  };
}
