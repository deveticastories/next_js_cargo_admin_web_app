import { Invoice } from "@/backend/models/Invoice";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Invoice).collection;
