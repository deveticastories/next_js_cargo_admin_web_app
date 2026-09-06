import { DailyExpense } from "@/backend/models/DailyExpense";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(DailyExpense).item;
