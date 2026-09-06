import { Container } from "@/backend/models/Container";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Container).item;
