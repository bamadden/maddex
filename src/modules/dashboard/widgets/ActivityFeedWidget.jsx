import { getActivityLog, iconFor } from '../../../services/activityLogService'
import { timeAgo } from '../../../utils/dateUtils'
import { WidgetBody, WidgetEmpty } from './_shared'

export default function ActivityFeedWidget() {
  const entries = getActivityLog()?.slice(0, 5) ?? []
  if (!entries.length) return <WidgetEmpty>No recent activity</WidgetEmpty>

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col gap-1.5 justify-center">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 text-[10px]">{iconFor(e.type)}</span>
            <span className="font-sans text-[10px] truncate min-w-0" style={{ color: '#8BA3C4' }}>{e.label}</span>
            <span className="ml-auto font-mono text-[8px] flex-shrink-0" style={{ color: '#4A6080' }}>{timeAgo(e.at)}</span>
          </div>
        ))}
      </div>
    </WidgetBody>
  )
}
