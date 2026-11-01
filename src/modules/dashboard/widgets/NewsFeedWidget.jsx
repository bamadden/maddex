import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../../../services/api'
import { timeAgo } from '../../../utils/dateUtils'
import {WidgetBody, WidgetEmpty} from './_shared'
import { goModule } from './navigate'
import { PAL } from '../../../styles/palette.js'

export default function NewsFeedWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ['news'],
    queryFn: fetchNews,
    staleTime: 3 * 60_000,
    select: (d) => d?.articles ?? [],
  })

  if (isLoading) return <WidgetBody />
  if (!data?.length) return <WidgetEmpty action="OPEN NEWS" onAction={() => goModule('news')}>No headlines</WidgetEmpty>

  return (
    <WidgetBody>
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 justify-center">
        {data.slice(0, 3).map((n, i) => (
          <button key={i} onClick={() => goModule('news')} className="text-left group">
            <div className="font-sans text-[11px] leading-snug line-clamp-2" style={{ color: PAL.bright }}>
              {n.headline}
            </div>
            <div className="font-mono text-[11px] mt-0.5" style={{ color: PAL.muted }}>
              {n.source} · {timeAgo(n.pubDate)}
            </div>
          </button>
        ))}
      </div>
    </WidgetBody>
  )
}
