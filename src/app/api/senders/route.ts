import { Sender } from "@/backend/models/Sender";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(Sender).collection;
