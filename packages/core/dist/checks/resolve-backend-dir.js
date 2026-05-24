import fs from "node:fs";
import path from "node:path";
/** Resolve first existing backend directory from SHIM_BACKEND_PATH_PATTERNS (comma-separated). */
export function resolveBackendDir(projectRoot, patterns = "supabase/functions,src/supabase/functions") {
    for (const raw of patterns.split(",")) {
        const candidate = raw.trim().replace(/^\/+/, "").replace(/\/+$/, "");
        if (!candidate)
            continue;
        const abs = path.join(projectRoot, candidate);
        if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) {
            return abs;
        }
    }
    return null;
}
//# sourceMappingURL=resolve-backend-dir.js.map