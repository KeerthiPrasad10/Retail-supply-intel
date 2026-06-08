"use client";

import { useEffect, useRef, useState } from "react";
import type { Go, Model, View } from "@/lib/types";
import { SUPPLIERS } from "@/lib/suppliers";
import { Icons } from "./icons";
import { ModelProvider } from "./model-context";
import { Sidebar } from "./sidebar";
import { SourceFooter } from "./source-footer";
import { Topbar } from "./topbar";
import { Overview } from "./views/overview";
import { Trending, type FilterTier, type Layout } from "./views/trending";
import { DeepDive } from "./views/deepdive";
import { MapView } from "./views/mapview";
import { Suppliers } from "./views/suppliers";
import { SupplierDrawer } from "./views/supplier-drawer";
import { Shortlist } from "./views/shortlist";
import { QuoteModal } from "./views/quote-modal";

export function Dashboard({ model }: { model: Model }) {
  const { trends } = model;
  const [view, setView] = useState<View>("overview");
  const [trendId, setTrendId] = useState<string | null>(null);
  const [supCtxId, setSupCtxId] = useState<string | null>(null);
  const [mapSel, setMapSel] = useState<string | null>(null);
  const [openSup, setOpenSup] = useState<string | null>(null);
  const [filterTier, setFilterTier] = useState<FilterTier>("All");
  const [layout, setLayout] = useState<Layout>("cards");
  const [dark, setDark] = useState(false);
  const [shortlist, setShortlist] = useState<Set<string>>(() => new Set());
  const [quoteIds, setQuoteIds] = useState<string[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const scroller = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  function flash(msg: string) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  const go: Go = (v, id) => {
    if (v === "deepdive") setTrendId(id ?? null);
    if (v === "suppliers") setSupCtxId(id ?? null);
    if (v === "map" && id !== undefined) setMapSel(id ?? null);
    setView(v);
    if (scroller.current) scroller.current.scrollTop = 0;
  };

  function toggleShort(id: string) {
    setShortlist((prev) => {
      const n = new Set(prev);
      if (n.has(id)) {
        n.delete(id);
        flash("Removed from shortlist");
      } else {
        n.add(id);
        flash("Added to shortlist");
      }
      return n;
    });
  }

  const trend = trends.find((x) => x.id === trendId) ?? null;
  const supCtx = trends.find((x) => x.id === supCtxId) ?? null;
  const openSupplier = openSup ? (SUPPLIERS.find((x) => x.id === openSup) ?? null) : null;

  const crumbs: Record<View, string[]> = {
    overview: ["Lidl · Buying", "Overview"],
    trending: ["Lidl · Buying", "Trending"],
    deepdive: ["Trending", trend ? trend.cat : "—"],
    map: ["Lidl · Buying", "Supply-chain map"],
    suppliers: supCtx ? ["Trending", supCtx.cat, "Suppliers"] : ["Lidl · Buying", "Suppliers"],
    shortlist: ["Lidl · Buying", "Shortlist"],
  };

  const requestQuote = (ids: string[]) => setQuoteIds(ids);

  return (
    <ModelProvider model={model}>
      <div className="app">
        <Sidebar view={view} go={go} shortlistCount={shortlist.size} />
        <main className="page">
          <Topbar crumbs={crumbs[view]} dark={dark} onToggleDark={() => setDark((d) => !d)}>
            <button className="btn secondary sm" onClick={() => go("map")}>
              <Icons.globe size={14} />
              Map
            </button>
            <button className="btn primary sm" onClick={() => go("trending")}>
              <Icons.trending size={14} />
              Trending
            </button>
          </Topbar>
          <div className="scroller" ref={scroller}>
            {view === "overview" && <Overview go={go} />}
            {view === "trending" && (
              <Trending
                go={go}
                layout={layout}
                setLayout={setLayout}
                filterTier={filterTier}
                setFilterTier={setFilterTier}
              />
            )}
            {view === "deepdive" && trend && <DeepDive trend={trend} go={go} showMap />}
            {view === "map" && <MapView go={go} selId={mapSel} setSel={setMapSel} />}
            {view === "suppliers" && (
              <Suppliers
                go={go}
                contextTrend={supCtx}
                openSupplier={setOpenSup}
                shortlist={shortlist}
                toggleShort={toggleShort}
              />
            )}
            {view === "shortlist" && (
              <Shortlist
                go={go}
                shortlist={shortlist}
                toggleShort={toggleShort}
                openSupplier={setOpenSup}
                requestQuote={requestQuote}
              />
            )}
            <SourceFooter />
          </div>
        </main>

        <SupplierDrawer
          s={openSupplier}
          close={() => setOpenSup(null)}
          inList={!!openSupplier && shortlist.has(openSupplier.id)}
          toggle={toggleShort}
          requestQuote={(ids) => {
            setOpenSup(null);
            requestQuote(ids);
          }}
        />
        {quoteIds && <QuoteModal ids={quoteIds} close={() => setQuoteIds(null)} />}
        {toast && (
          <div className="toast-live">
            <Icons.check size={15} />
            {toast}
          </div>
        )}
      </div>
    </ModelProvider>
  );
}
