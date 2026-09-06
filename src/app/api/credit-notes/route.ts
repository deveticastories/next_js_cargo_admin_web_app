import { CreditNote } from "@/backend/models/CreditNote";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(CreditNote).collection;
