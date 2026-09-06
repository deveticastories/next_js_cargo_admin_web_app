import { Receiver } from "@/backend/models/Receiver";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Receiver).collection;
