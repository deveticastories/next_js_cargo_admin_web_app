import { DeliveryPartner, ensureDeliveryPartnerIndexes } from "@/backend/models/DeliveryPartner";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(DeliveryPartner, { beforeWrite: ensureDeliveryPartnerIndexes }).item;
