import { Product } from "@/backend/models/Product";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Product).item;
