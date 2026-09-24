import { Country } from "@/backend/models/Country";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Country).collection;
