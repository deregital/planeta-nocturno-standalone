export type EventFilters = {
  query?: string;
};

export type EventSearchable = {
  name: string;
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
  if (query && !normalizeText(event.name).includes(normalizeText(query))) {
    return false;
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
