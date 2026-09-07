import { toast } from "sonner";
import { dbPromise } from "./db";
import { LocalLyricsManager } from "./Lyrics/manager";
import { openSettingsPanel } from "./settings";
import { OpenLyricsDBPanel } from "./openLyricsDBPanel";
import { DeepFreeze } from "./utils";
import { BreakerDebug } from "./API/CircuitBreaker";
import GetProgress from "./Gets/GetProgress";

export function exposeToWindow() {
    const api = {
        panels: {
            settings: {
                open: () => openSettingsPanel(),
            },
            lyricsDB: {
                open: () => OpenLyricsDBPanel(),
            },
        },
        db: {
            dbPromise: dbPromise,
            objectStores: {
                lyricsStore: {
                    manager: LocalLyricsManager,
                }
            }
        },
        testing: {
            toaster: toast,
            // Escape hatch: a bad persisted breaker state would otherwise mean
            // telling users to clear localStorage by hand.
            breaker: BreakerDebug,
            getProgress: () => GetProgress(),
        }
    };

    (window as any).SpicyLyrics = DeepFreeze(api);
}
