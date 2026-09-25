import { Fabric } from "@/backend/models/Fabric";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Fabric).collection;
