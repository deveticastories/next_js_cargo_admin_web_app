import { PickupPartner } from "@/backend/models/PickupPartner";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(PickupPartner).item;
