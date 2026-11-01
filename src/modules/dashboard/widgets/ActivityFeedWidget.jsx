import { getActivityLog, iconFor } from '../../../services/activityLogService'
import { timeAgo } from '../../../utils/dateUtils'
import { WidgetBody, WidgetEmpty } from './_shared'
import { PAL } from '../../../styles/palette.js'

export default function ActivityFeedWidget() {
  const entries = getActivityLog()?.slice(0, 5) ?? []
  if (!entries.length) return <WidgetEmpty>No recent activity</WidgetEmpty>

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col gap-1.5 justify-center">
        {entries.map((e, i) => (
          <div key={i} className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 text-[11px]">{iconFor(e.type)}</span>
            <span className="font-sans text-[11px] truncate min-w-0" style={{ color: PAL.dim }}>{e.label}</span>
            <span className="ml-auto font-mono text-[11px] flex-shrink-0" style={{ color: PAL.muted }}>{timeAgo(e.at)}</span>
          </div>
        ))}
      </div>
    </WidgetBody>
  )
}
