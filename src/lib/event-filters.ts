export type EventFilters = {
  query?: string;
};

export type EventSearchable = {
  name: string;
  location?: {
    name?: string | null;
    address?: string | null;
  } | null;
};

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function hasActiveEventFilters(filters: EventFilters) {
  return Boolean(filters.query?.trim());
}

export function eventMatchesFilters(
  event: EventSearchable,
  filters: EventFilters,
) {
  const query = filters.query?.trim();
  if (query) {
    const normalizedQuery = normalizeText(query);
    const searchableFields = [
      event.name,
      event.location?.name,
      event.location?.address,
    ].filter(Boolean);

    const matchesQuery = searchableFields.some((field) =>
      normalizeText(String(field)).includes(normalizedQuery),
    );

    if (!matchesQuery) {
      return false;
    }
  }

  return true;
}

export function filterEventGroup<
  TEvent extends EventSearchable,
  TFolder extends { events: TEvent[] },
>(
  group: { folders: TFolder[]; withoutFolders: TEvent[] },
  filters: EventFilters,
) {
  const hideEmptyFolders = hasActiveEventFilters(filters);

  return {
    folders: group.folders
      .map((folder) => ({
        ...folder,
        events: folder.events.filter((event) =>
          eventMatchesFilters(event, filters),
        ),
      }))
      .filter((folder) => !hideEmptyFolders || folder.events.length > 0),
    withoutFolders: group.withoutFolders.filter((event) =>
      eventMatchesFilters(event, filters),
    ),
  };
}

export function eventGroupHasEvents<TEvent>(group: {
  folders: { events: TEvent[] }[];
  withoutFolders: TEvent[];
}) {
  return (
    group.withoutFolders.length > 0 ||
    group.folders.some((folder) => folder.events.length > 0)
  );
}
