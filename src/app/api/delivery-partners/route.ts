import { DeliveryPartner, ensureDeliveryPartnerIndexes } from "@/backend/models/DeliveryPartner";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(DeliveryPartner, { beforeWrite: ensureDeliveryPartnerIndexes }).collection;
