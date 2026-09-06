import { CreditNote } from "@/backend/models/CreditNote";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(CreditNote).item;
