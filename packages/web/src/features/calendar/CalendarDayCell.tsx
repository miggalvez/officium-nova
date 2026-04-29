import type { CalendarDayDto } from '../../api/types';

export interface CalendarDayCellProps {
  readonly day: CalendarDayDto;
  readonly selected: boolean;
  readonly onSelect: (day: CalendarDayDto) => void;
}

export function CalendarDayCell({
  day,
  selected,
  onSelect
}: CalendarDayCellProps): JSX.Element {
  const date = day.date;
  const dayNumber = date.split('-')[2];
  return (
    <button
      type="button"
      className="calendar__cell"
      aria-pressed={selected}
      onClick={() => onSelect(day)}
    >
      <span className="calendar__date">{Number(dayNumber)}</span>
      <span className="calendar__title" title={day.celebration.feast.title}>
        {day.celebration.feast.title}
      </span>
      <span className="calendar__rank">
        {day.celebration.rank.classSymbol} · {day.season}
      </span>
      {day.commemorations.length > 0 ? (
        <span className="calendar__commemorations">
          + {day.commemorations.length} commemoration
          {day.commemorations.length === 1 ? '' : 's'}
        </span>
      ) : null}
      {day.warnings.length > 0 ? (
        <span className="calendar__warn" title="Warnings present">
          ⚠ {day.warnings.length}
        </span>
      ) : null}
    </button>
  );
}
