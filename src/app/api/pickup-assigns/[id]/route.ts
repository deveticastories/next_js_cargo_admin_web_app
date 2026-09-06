import { PickupAssign } from "@/backend/models/PickupAssign";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(PickupAssign).item;
