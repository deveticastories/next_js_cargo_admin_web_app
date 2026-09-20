import { ReceiptEntry } from "@/backend/models/ReceiptEntry";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(ReceiptEntry).collection;
