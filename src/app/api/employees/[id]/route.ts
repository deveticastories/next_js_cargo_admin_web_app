import { Employee } from "@/backend/models/Employee";
import { createCrudController } from "@/backend/controllers/crudController";

export const { PATCH, DELETE } = createCrudController(Employee).item;
