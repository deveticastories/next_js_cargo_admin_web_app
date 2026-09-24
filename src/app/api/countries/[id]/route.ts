import { Country } from "@/backend/models/Country";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Country).item;
