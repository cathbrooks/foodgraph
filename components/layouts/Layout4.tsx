"use client";

import { ChatBubble } from "@/components/chat/ChatBubble";
import { RestaurantCard } from "@/components/restaurants/RestaurantCard";
import { RestaurantCardSkeleton } from "@/components/restaurants/RestaurantCardSkeleton";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";
import type { ScoredRecommendation } from "@/types/recommendation";
import type { LayoutProps } from "./types";

export function Layout4(props: LayoutProps) {
  const {
    messages, input, setInput, loading, budgetPromptLoading,
    locationReady, locationPending, locationFailed, locError, hasStarted,
    pendingConfirmation, showBudgetChips, setShowBudgetChips,
    selectedPlaceId, placeDetails, detailsLoading,
    expandedMessages, setExpandedMessages,
    scrollRef, inputRef, scrollToBottom,
    handleSubmit, handleChipClick, handleFindFood, handleWildcard,
    handleBudgetSelection, handleCardClick, handleCardSelect,
    requestLocation, greeting, onNewChat, welcomeChips, budgetChips,
  } = props;

  const INITIAL_COUNT = 3;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Action bar */}
      <div className="flex items-center justify-center gap-3 px-4 py-3 bg-white border-b border-gray-100">
        <button
          onClick={onNewChat}
          className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
          title="New chat"
          aria-label="New chat"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        </button>
        <button
          onClick={handleFindFood}
          disabled={loading || !locationReady}
          className="text-xs font-semibold text-white bg-black rounded-full px-3 py-1.5 disabled:opacity-40"
        >
          Quick Find
        </button>
        <button
          onClick={handleWildcard}
          disabled={loading || !locationReady}
          className="text-lg disabled:opacity-40"
          title="Give me a wildcard pick"
        >
          🎲
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3 max-w-lg mx-auto">
          {!hasStarted && (
            <div className="flex flex-col items-center pt-16 pb-8 text-center space-y-6">
              {locationPending && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Spinner size="sm" />
                  Getting your location&hellip;
                </div>
              )}
              {locationFailed && (
                <div className="space-y-2">
                  <p className="text-sm text-red-500">{locError ?? "Location access required."}</p>
                  <Button variant="secondary" onClick={requestLocation}>Try again</Button>
                </div>
              )}
              {locationReady && (
                <>
                  <div>
                    <h1 className="text-3xl font-black tracking-tight">{greeting}</h1>
                    <p className="text-sm text-gray-400 mt-1">Tell me what you want, or tap a suggestion.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {welcomeChips.map((chip) => (
                      <button
                        key={chip.label}
                        onClick={() => handleChipClick(chip)}
                        className="rounded-full bg-gray-50 border border-gray-200 px-3.5 py-2 text-xs font-medium text-gray-700 active:bg-gray-100"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              <ChatBubble role={msg.role}><p className="text-sm whitespace-pre-wrap">{msg.content}</p></ChatBubble>
              {msg.recommendations && msg.recommendations.length > 0 && (() => {
                const isExpanded = expandedMessages.has(msg.id);
                const visible = isExpanded ? msg.recommendations : msg.recommendations.slice(0, INITIAL_COUNT);
                const hiddenCount = msg.recommendations.length - INITIAL_COUNT;
                return (
                  <div className="space-y-2">
                    {visible.map((rec: ScoredRecommendation, idx: number) => (
                      <RestaurantCard key={idx} recommendation={rec} onClick={() => handleCardClick(rec)} onSelect={() => handleCardSelect(rec)} selected={selectedPlaceId === rec.restaurant.place_id} details={placeDetails[rec.restaurant.place_id] ?? null} detailsLoading={detailsLoading === rec.restaurant.place_id} />
                    ))}
                    {hiddenCount > 0 && !isExpanded && (
                      <button onClick={() => { setExpandedMessages((prev) => { const n = new Set(prev); n.add(msg.id); return n; }); scrollToBottom(); }} className="w-full rounded-lg bg-indigo-50 py-2.5 text-xs font-medium text-indigo-600">Show {hiddenCount} more</button>
                    )}
                  </div>
                );
              })()}
            </div>
          ))}

          {pendingConfirmation && !loading && (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => handleBudgetSelection("slot")} className="rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-2 text-xs font-medium text-indigo-700">My budget</button>
                <button onClick={() => setShowBudgetChips(!showBudgetChips)} className={`rounded-full border px-3.5 py-2 text-xs font-medium ${showBudgetChips ? "bg-indigo-500 text-white border-indigo-500" : "bg-indigo-50 border-indigo-100 text-indigo-700"}`}>Custom</button>
                <button onClick={() => handleBudgetSelection("none")} className="rounded-full bg-indigo-50 border border-indigo-100 px-3.5 py-2 text-xs font-medium text-indigo-700">Skip budget</button>
              </div>
              {showBudgetChips && (
                <div className="flex flex-wrap gap-2">
                  {budgetChips.map((c) => (<button key={c.value} onClick={() => handleBudgetSelection("custom", c.value)} className="rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs font-medium text-emerald-700">{c.label}</button>))}
                </div>
              )}
            </div>
          )}

          {budgetPromptLoading && <ChatBubble role="assistant"><div className="flex items-center gap-2"><Spinner size="sm" /><span className="text-sm">Thinking&hellip;</span></div></ChatBubble>}
          {loading && (
            <div className="space-y-2">
              <ChatBubble role="assistant"><div className="flex items-center gap-2"><Spinner size="sm" /><span className="text-sm">Finding spots&hellip;</span></div></ChatBubble>
              <RestaurantCardSkeleton /><RestaurantCardSkeleton />
            </div>
          )}
        </div>
      </div>

      {/* Input at bottom */}
      <div className="border-t border-gray-100 bg-white px-4 py-2.5 safe-area-bottom">
        <form onSubmit={handleSubmit} className="flex gap-2 max-w-lg mx-auto items-center">
          <div className="flex-1 relative">
            <input
              ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={pendingConfirmation && showBudgetChips ? "Budget..." : locationReady ? "Ask me anything about food..." : "Enable location"}
              disabled={loading || budgetPromptLoading || !locationReady}
              className="w-full rounded-full bg-gray-100 pl-4 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-50"
            />
            <button type="submit" disabled={loading || budgetPromptLoading || !input.trim() || !locationReady} className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-indigo-500 text-white rounded-full w-7 h-7 flex items-center justify-center disabled:opacity-30">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" /></svg>
            </button>
          </div>
          {hasStarted && !pendingConfirmation && (
            <button type="button" onClick={handleWildcard} disabled={loading || !locationReady} className="shrink-0 text-lg disabled:opacity-40" title="Wildcard">🎲</button>
          )}
        </form>
      </div>
    </div>
  );
}
