import { Invoice } from "@/backend/models/Invoice";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Invoice).item;
