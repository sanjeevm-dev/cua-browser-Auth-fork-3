import { cn } from "@/lib/utils";
import { SessionLiveURLs } from "@browserbasehq/sdk/resources/index.mjs";
import { useEffect, useState } from "react";

let abortController: AbortController | null = null;
let errors = 0;
async function getPages(sessionId: string) {
  try {
    // abort any previous requests
    if (abortController) {
      abortController.abort("Aborted previous request");
    }
    abortController = new AbortController();
    const res = await fetch(`/api/session/${sessionId}/pages`, {
      signal: abortController.signal,
    });

    // retry 3 times if the request fails
    if (!res.ok) {
      errors++;
      if (errors > 3) {
        throw new Error("Failed to fetch pages");
      }
      return [];
    }

    const data = await res.json();
    errors = 0;
    return data.pages;
  } catch (error: unknown) {
    // abort error is expected when the request is aborted
    if (
      (error instanceof Error && error.name === "AbortError") ||
      error === "Aborted previous request"
    ) {
      return [];
    }

    console.error("Error fetching pages:", error);
    return [];
  }
}

const refetchInterval = 5000;

export default function BrowserTabs({
  sessionId,
  activePage,
  setActivePage,
}: {
  sessionId: string;
  activePage: SessionLiveURLs.Page | null;
  setActivePage: (page: SessionLiveURLs.Page) => void;
}) {
  const [pages, setPages] = useState<SessionLiveURLs.Page[]>([]);

  useEffect(() => {
    const refetchPages = async () => {
      const p = await getPages(sessionId);
      // when a new page is added, set the active page to the last page
      if (p.length > pages.length) {
        setActivePage(p[p.length - 1]);
      }

      setPages(p);
    };

    refetchPages();
    const interval = setInterval(refetchPages, refetchInterval);

    return () => clearInterval(interval);
  }, [pages.length, sessionId, setActivePage]);

  // fallback to first page if activePageId is not found
  useEffect(() => {
    if (!activePage && pages.length > 0) {
      setActivePage(pages[0]);
    }
  }, [activePage, pages, setActivePage]);

  if (pages.length === 0 || !activePage) {
    return null;
  }

  const tabLoading = (t: SessionLiveURLs.Page) => !Boolean(t.title || t.url);

  // hide tabs if there is only one page
  if (pages.length < 2) {
    return null;
  }

  return (
    <div className="w-full overflow-x-auto max-w-[1000px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-1">
      <div
        className="grid gap-1.5 md:gap-2 w-full justify-start"
        style={{
          gridTemplateColumns: `repeat(${pages.length}, minmax(80px,300px))`,
        }}
      >
        {pages.map((page) => (
          <div
            key={page.id}
            onClick={() => setActivePage(page)}
            className={cn(
              "bg-black/[0.3] backdrop-blur-xl rounded-lg text-white/90 border border-white/[0.08] text-xs md:text-sm flex gap-x-1 py-1.5 px-2 max-w-[300px] cursor-pointer hover:border-white/[0.15] transition-all min-h-[44px] items-center",
              {
                "bg-blue-600/20 text-white border-blue-500/30":
                  page.id === activePage?.id,
              }
            )}
          >
            {page.faviconUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={page.faviconUrl} alt={page.title} className="size-3 flex-shrink-0" />
            )}
            {tabLoading(page) ? (
              <span className="text-white/40 animate-pulse text-xs md:text-sm">Loading...</span>
            ) : (
              <span className="truncate text-ellipsis whitespace-nowrap text-xs md:text-sm">
                {page.title || page.url}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
