import { Store } from "@/backend/models/Store";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Store).item;
