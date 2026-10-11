/**
 * Thin re-export so screens that only needed the error type don't have to
 * know the transport moved to `src/services/httpClient.ts`. Packing lists
 * and stuffing used to be rerouted here to an in-memory store (see the
 * removed `PackingListLocalApi`/`StuffingWorkflowLocalApi` in
 * `LocalWorkflowServices.ts`) — they're both real cargo-backend modules now,
 * via `src/services/PackageServices.ts` and `src/services/StuffingServices.ts`.
 */
export { ApiError } from "@/services/httpClient";
