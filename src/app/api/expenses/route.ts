import { DailyExpense } from "@/backend/models/DailyExpense";
import { createCrudController } from "@/backend/controllers/crudController";

export const { GET, POST } = createCrudController(DailyExpense).collection;
