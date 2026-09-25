import { Fabric } from "@/backend/models/Fabric";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Fabric).item;
