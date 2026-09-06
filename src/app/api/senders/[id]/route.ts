import { Sender } from "@/backend/models/Sender";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Sender).item;
