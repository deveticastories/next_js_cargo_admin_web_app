import { Product } from "@/backend/models/Product";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Product).collection;
