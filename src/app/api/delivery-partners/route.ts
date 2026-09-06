import { DeliveryPartner } from "@/backend/models/DeliveryPartner";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(DeliveryPartner).collection;
