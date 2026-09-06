import { Container } from "@/backend/models/Container";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Container).collection;
