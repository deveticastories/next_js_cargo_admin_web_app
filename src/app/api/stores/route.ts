import { Store } from "@/backend/models/Store";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Store).collection;
