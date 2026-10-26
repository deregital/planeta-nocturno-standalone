export const EVENT_LIST_ROOT_KEY = 'root';

export type EventListScope = 'upcoming' | 'past';

export type EventListOrderRow = {
  scope: string;
  containerKey: string;
  itemKind: string;
  itemId: string;
  position: number;
};

type WithListPosition<T> = T & { listPosition: number };

export function applyUserEventListOrder<
  TEvent extends { id: string },
  TFolder extends { id: string; events: TEvent[] },
>(
  group: { folders: TFolder[]; withoutFolders: TEvent[] },
  scope: EventListScope,
  rows: EventListOrderRow[],
): {
  folders: Array<
    Omit<TFolder, 'events'> & {
      events: Array<WithListPosition<TEvent>>;
      listPosition: number;
    }
  >;
  withoutFolders: Array<WithListPosition<TEvent>>;
} {
  const scopeRows = rows.filter((row) => row.scope === scope);
  const rootPositions = positionMap(
    scopeRows.filter((row) => row.containerKey === EVENT_LIST_ROOT_KEY),
  );

  const defaultRoot = [
    ...group.folders.map((folder) => ({
      kind: 'folder' as const,
      id: folder.id,
      folder,
    })),
    ...group.withoutFolders.map((event) => ({
      kind: 'event' as const,
      id: event.id,
      event,
    })),
  ];

  const orderedRoot = placeByPosition(defaultRoot, (item) =>
    rootPositions.get(`${item.kind}:${item.id}`),
  );

  const folders: Array<
    Omit<TFolder, 'events'> & {
      events: Array<WithListPosition<TEvent>>;
      listPosition: number;
    }
  > = [];
  const withoutFolders: Array<WithListPosition<TEvent>> = [];

  for (const entry of orderedRoot) {
    if (entry.item.kind === 'folder') {
      const eventPositions = positionMap(
        scopeRows.filter(
          (row) =>
            row.containerKey === entry.item.id && row.itemKind === 'event',
        ),
      );
      folders.push({
        ...entry.item.folder,
        listPosition: entry.listPosition,
        events: placeByPosition(entry.item.folder.events, (event) =>
          eventPositions.get(`event:${event.id}`),
        ).map((placed) => ({
          ...placed.item,
          listPosition: placed.listPosition,
        })),
      });
      continue;
    }

    withoutFolders.push({
      ...entry.item.event,
      listPosition: entry.listPosition,
    });
  }

  return { folders, withoutFolders };
}

function positionMap(rows: EventListOrderRow[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(`${row.itemKind}:${row.itemId}`, row.position);
  }
  return map;
}

function placeByPosition<T>(
  items: T[],
  positionOf: (item: T) => number | undefined,
) {
  const positioned: { item: T; position: number }[] = [];
  const unpositioned: T[] = [];

  for (const item of items) {
    const position = positionOf(item);
    if (position === undefined) unpositioned.push(item);
    else positioned.push({ item, position });
  }

  positioned.sort((a, b) => a.position - b.position);
  const start =
    positioned.length === 0
      ? 0
      : Math.max(...positioned.map((entry) => entry.position)) + 1;

  return [
    ...positioned.map((entry) => ({
      item: entry.item,
      listPosition: entry.position,
    })),
    ...unpositioned.map((item, index) => ({
      item,
      listPosition: start + index,
    })),
  ];
}
