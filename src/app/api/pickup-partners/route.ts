import { PickupPartner } from "@/backend/models/PickupPartner";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(PickupPartner).collection;
