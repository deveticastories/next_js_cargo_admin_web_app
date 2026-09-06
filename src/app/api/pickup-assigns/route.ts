import { PickupAssign } from "@/backend/models/PickupAssign";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(PickupAssign).collection;
