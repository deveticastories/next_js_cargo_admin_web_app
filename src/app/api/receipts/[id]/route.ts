import { ReceiptEntry } from "@/backend/models/ReceiptEntry";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(ReceiptEntry).item;
