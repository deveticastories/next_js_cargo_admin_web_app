/** Containers moving between Kochi and the UAE — cargo-backend's `/containers` module. */
import type { Container } from "@/types";
import { createCrudService, nextSequentialCode, type BackendDoc, type EntityService } from "./entityHelpers";
import { API_ENDPOINTS } from "@/constants/ApiConstants";

function toFrontend(doc: BackendDoc): Container {
  return {
    id: doc._id,
    code: String(doc.containerCode ?? doc._id),
    status: (doc.containerStatus as Container["status"]) ?? "Active",
    company: String(doc.company ?? ""),
    stuffingCode: doc.stuffingCode ? String(doc.stuffingCode) : undefined,
    stuffingDate: String(doc.stuffingDate ?? ""),
    cutOffDate: doc.cutOffDate ? String(doc.cutOffDate) : undefined,
    etaCok: doc.etaCok ? String(doc.etaCok) : undefined,
    etdCok: doc.etdCok ? String(doc.etdCok) : undefined,
    etaUae: doc.etaUae ? String(doc.etaUae) : undefined,
  };
}

async function toBackend(body: Record<string, unknown>) {
  // The form never collects a container code — cargo-backend still requires
  // one (unique), so a fresh one is generated here on create only.
  const containerCode = body.code || (await nextSequentialCode(API_ENDPOINTS.CONTAINERS.BASE, "containerList", "containerCode", "CTN"));
  return {
    containerCode,
    company: body.company,
    stuffingCode: body.stuffingCode || undefined,
    stuffingDate: body.stuffingDate,
    cutOffDate: body.cutOffDate || undefined,
    etaCok: body.etaCok || undefined,
    etdCok: body.etdCok || undefined,
    etaUae: body.etaUae || undefined,
    containerStatus: body.status || undefined,
  };
}

export const ContainerServices: EntityService<Container> = createCrudService<Container>({
  basePath: API_ENDPOINTS.CONTAINERS.BASE,
  listKey: "containerList",
  itemKey: "data",
  toFrontend,
  toBackend,
});
