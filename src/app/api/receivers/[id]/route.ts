import { Receiver } from "@/backend/models/Receiver";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Receiver).item;
