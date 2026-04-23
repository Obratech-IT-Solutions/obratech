import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

type Props = {
  month: Date;
  onMonthChange: (month: Date) => void;
  selected: Date | undefined;
  onSelect: (day: Date | undefined) => void;
  meetingDays: Date[];
  deadlineDays: Date[];
};

export function CrmLandingCalendar({
  month,
  onMonthChange,
  selected,
  onSelect,
  meetingDays,
  deadlineDays,
}: Props) {
  return (
    <div className="crm-calendar-panel">
      <div className="crm-calendar-legend" aria-hidden>
        <span className="crm-cal-legend-item">
          <i className="crm-cal-dot crm-cal-dot-meeting" /> Meeting date
        </span>
        <span className="crm-cal-legend-item">
          <i className="crm-cal-dot crm-cal-dot-deadline" /> Deadline
        </span>
      </div>
      <div className="crm-calendar-wrap">
        <DayPicker
          month={month}
          onMonthChange={onMonthChange}
          mode="single"
          selected={selected}
          onSelect={onSelect}
          modifiers={{ meeting: meetingDays, deadline: deadlineDays }}
          modifiersClassNames={{
            meeting: "crm-cal-day-meeting",
            deadline: "crm-cal-day-deadline",
          }}
        />
      </div>
    </div>
  );
}
