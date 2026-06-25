import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchNews } from '../../services/api'
import { BREAKING_NEWS_THRESHOLD_MINUTES } from '../../data/placeholders'
import { useStore } from '../../store/useStore'
import { Badge } from '../../components/ui/Panel'
import { DataUnavailable } from '../../components/ui/DataUnavailable'

const TAG_VARIANTS = {
  MACRO:    'gold',
  AU:       'gold',
  EQUITY:   'blue',
  ENERGY:   'red',
  FX:       'default',
  CRYPTO:   'green',
  RATES:    'default',
  'M&A':    'gold',
  INTL:     'blue',
  EARNINGS: 'red',
}

const AU_PRIORITY_SOURCES = new Set(['AFR', 'ASX', 'RBA'])

function isBreakingNews(item) {
  if (!item?.pubDate) return false
  const ageMs = Date.now() - new Date(item.pubDate).getTime()
  return ageMs <= BREAKING_NEWS_THRESHOLD_MINUTES * 60 * 1000
}

export default function NewsModule() {
  const [activeTag, setActiveTag]   = useState('ALL')
  const [selected, setSelected]     = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const { addChatMessage, setChatOpen, newsFilter, setNewsFilter } = useStore()

  // Apply news filter from command bar (NEWS {keyword} command)
  useEffect(() => {
    if (newsFilter) {
      setSearchTerm(newsFilter)
      setNewsFilter('')
    }
  }, [newsFilter, setNewsFilter])

  const { data: liveNews, isError, isFetching, refetch } = useQuery({
    queryKey: ['news'],
    queryFn:  fetchNews,
    staleTime: 5 * 60_000,
    retry: 1,
  })

  const rawFeed = liveNews && liveNews.length > 0 ? liveNews : []
  const isLive  = !!liveNews && !isError && liveNews.length > 0

  // Apply search filter
  const searchFiltered = searchTerm
    ? rawFeed.filter((n) => n.headline.toLowerCase().includes(searchTerm.toLowerCase()) || n.summary?.toLowerCase().includes(searchTerm.toLowerCase()))
    : rawFeed

  // AU articles: tag==='AU' or source in AU_PRIORITY_SOURCES
  const sortedFeed = [...searchFiltered].sort((a, b) => {
    const aPriority = (AU_PRIORITY_SOURCES.has(a.source) || a.tag === 'AU') ? 0 : 1
    const bPriority = (AU_PRIORITY_SOURCES.has(b.source) || b.tag === 'AU') ? 0 : 1
    return aPriority - bPriority
  })

  const allTags = ['ALL', 'AU', ...new Set(rawFeed.map((n) => n.tag).filter((t) => t !== 'AU'))]

  const filtered = activeTag === 'ALL'
    ? sortedFeed
    : activeTag === 'AU'
      ? sortedFeed.filter((n) => n.tag === 'AU' || AU_PRIORITY_SOURCES.has(n.source))
      : sortedFeed.filter((n) => n.tag === activeTag)

  const displaySelected  = selected ?? filtered[0]
  const latestBreaking   = filtered.find(isBreakingNews)

  const askAI = (item) => {
    setChatOpen(true)
    const tickerLine = item.tickers?.length ? `\nRelated tickers: ${item.tickers.join(', ')}` : ''
    addChatMessage({
      role: 'user',
      content: `Analyse this news from an Australian investor perspective: "${item.headline}"${tickerLine}\n\nWhat is the likely market impact for ASX and AUD?`,
    })
  }

  // Show error state if news API failed and we have no articles
  if (isError && rawFeed.length === 0) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        <div className="panel-header flex items-center gap-2 flex-shrink-0">
          LIVE NEWS FEED
          <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <DataUnavailable label="NEWS FEED UNAVAILABLE" onRetry={refetch} />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Breaking news banner */}
      {latestBreaking && (
        <div className="flex items-center gap-3 px-3 py-1 bg-terminal-red/10 border-b border-terminal-red/40 flex-shrink-0 animate-pulse">
          <span className="text-terminal-red text-2xs font-bold tracking-widest flex-shrink-0">● BREAKING</span>
          <span className="text-2xs text-terminal-text truncate">{latestBreaking.headline}</span>
          <span className="text-2xs text-terminal-text-dim flex-shrink-0">{latestBreaking.time}</span>
        </div>
      )}

      <div className="flex-1 grid grid-cols-[320px_1fr] overflow-hidden min-h-0">
        {/* Left: feed */}
        <div className="flex flex-col border-r border-terminal-border overflow-hidden">
          <div className="panel-header flex items-center gap-2 flex-shrink-0">
            LIVE NEWS FEED
            {isFetching  && <span className="text-terminal-text-dim text-2xs font-normal ml-auto">LOADING...</span>}
            {isLive && !isFetching && <span className="text-terminal-green text-2xs font-normal normal-case ml-auto">● LIVE</span>}
            {isError     && <span className="text-terminal-red text-2xs font-normal ml-auto">⚠ ERROR</span>}
          </div>

          {/* Search bar */}
          <div className="flex items-center gap-1 px-2 py-1 border-b border-terminal-border flex-shrink-0">
            <span className="text-terminal-text-dim text-2xs">⌕</span>
            <input
              className="cmd-input flex-1 text-2xs py-0"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setSelected(null) }}
              placeholder="Filter headlines... (CMD: NEWS {keyword})"
            />
            {searchTerm && (
              <button onClick={() => { setSearchTerm(''); setSelected(null) }} className="text-terminal-text-dim/40 hover:text-terminal-text-dim text-xs">✕</button>
            )}
          </div>

          {/* Tag filters */}
          <div className="flex flex-wrap gap-1 p-1.5 border-b border-terminal-border flex-shrink-0">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => { setActiveTag(tag); setSelected(null) }}
                className={`text-2xs px-2 py-0.5 transition-colors ${
                  activeTag === tag
                    ? 'bg-terminal-gold text-terminal-bg font-bold'
                    : 'text-terminal-text-dim hover:text-terminal-text border border-terminal-border'
                }`}
              >
                {tag}
              </button>
            ))}
            {searchTerm && (
              <span className="text-2xs px-2 py-0.5 border border-terminal-gold/40 text-terminal-gold">
                FILTER: {searchTerm}
              </span>
            )}
          </div>

          {/* Articles */}
          <div className="flex-1 overflow-auto">
            {!isFetching && rawFeed.length === 0 ? (
              <div className="p-4 text-2xs text-terminal-text-dim text-center">No articles available</div>
            ) : (
              filtered.map((item) => {
                const breaking = isBreakingNews(item)
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelected(item)}
                    className={`border-b border-terminal-border/50 p-2 cursor-pointer transition-colors ${
                      displaySelected?.id === item.id
                        ? 'bg-terminal-accent border-l-2 border-l-terminal-gold'
                        : breaking
                          ? 'hover:bg-terminal-accent/20 border-l-2 border-l-terminal-red/50'
                          : 'hover:bg-terminal-accent/20'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-2xs text-terminal-text-dim">{item.time}</span>
                      <Badge variant={TAG_VARIANTS[item.tag] || 'default'}>{item.tag}</Badge>
                      <span className="text-2xs text-terminal-text-dim">{item.source}</span>
                      {breaking && (
                        <span className="text-2xs text-terminal-red animate-pulse ml-auto">NEW</span>
                      )}
                    </div>
                    <p className="text-2xs text-terminal-text leading-relaxed line-clamp-2">{item.headline}</p>
                    <div className="flex items-center justify-between mt-1">
                      {item.tickers?.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {item.tickers.slice(0, 3).map((t) => (
                            <span key={t} className="text-2xs text-terminal-blue-bright">${t}</span>
                          ))}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); askAI(item) }}
                        className="text-2xs text-terminal-text-dim hover:text-terminal-gold ml-auto transition-colors px-1"
                        title="Ask AI about this article"
                      >
                        &#9650; AI
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <div className="border-t border-terminal-border p-2 flex-shrink-0">
            <div className="text-2xs text-terminal-text-dim">
              {filtered.length} articles · AFR, Reuters, CNBC
            </div>
          </div>
        </div>

        {/* Right: article detail */}
        <div className="flex flex-col overflow-hidden">
          {displaySelected ? (
            <>
              <div className="panel-header flex items-center gap-2">
                <Badge variant={TAG_VARIANTS[displaySelected.tag] || 'default'}>{displaySelected.tag}</Badge>
                <span className="text-terminal-text-dim">{displaySelected.source}</span>
                <span className="text-terminal-text-dim">·</span>
                <span className="text-terminal-text-dim">{displaySelected.time}</span>
                {isBreakingNews(displaySelected) && (
                  <span className="text-terminal-red text-2xs animate-pulse">● BREAKING</span>
                )}
                <button
                  onClick={() => askAI(displaySelected)}
                  className="ml-auto text-2xs text-terminal-gold hover:bg-terminal-gold hover:text-terminal-bg px-2 py-0.5 border border-terminal-gold transition-colors"
                >
                  &#9650; AI ANALYSIS
                </button>
              </div>
              <div className="p-4 flex-1 overflow-auto">
                <h2 className="text-sm font-bold text-terminal-text-bright leading-relaxed mb-3">
                  {displaySelected.headline}
                </h2>

                {/* Summary (from RSS description) */}
                {displaySelected.summary && (
                  <p className="text-2xs text-terminal-text leading-relaxed mb-4 border-l-2 border-terminal-border pl-3">
                    {displaySelected.summary}
                  </p>
                )}

                {/* Read full article link */}
                {displaySelected.link && (
                  <a
                    href={displaySelected.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-2xs text-terminal-blue-bright hover:text-terminal-gold transition-colors block mb-4"
                  >
                    READ FULL ARTICLE →
                  </a>
                )}

                {/* Tickers */}
                {displaySelected.tickers?.length > 0 && (
                  <div className="border-t border-terminal-border pt-3">
                    <div className="text-2xs text-terminal-gold mb-2 font-bold">DETECTED TICKERS</div>
                    <div className="flex flex-wrap gap-2">
                      {displaySelected.tickers.map((t) => (
                        <button
                          key={t}
                          onClick={() => askAI({ ...displaySelected, headline: `Analyse ${t} in the context of: ${displaySelected.headline}` })}
                          className="text-xs text-terminal-text-bright border border-terminal-border px-3 py-1 hover:border-terminal-gold hover:text-terminal-gold transition-colors"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-terminal-text-dim text-2xs">
              SELECT AN ARTICLE
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
